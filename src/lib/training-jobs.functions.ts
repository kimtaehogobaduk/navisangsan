import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractYoutubeUrls(input: string): string[] {
  const matches = input.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[A-Za-z0-9_\-?=&%]+/g);
  return (matches ?? []).map((u) => u.replace(/[)\],.]+$/g, ""));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export const queueYoutubeJobsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      urls: z.array(z.string().min(1)).min(1).max(10000),
      category: z.string().min(1).max(60).default("기타"),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.urls
      .flatMap((u) => extractYoutubeUrls(u.trim()))
      .filter(Boolean)
      .map((u) => extractYoutubeId(u))
      .filter((id): id is string => !!id)
      .filter((id, index, arr) => arr.indexOf(id) === index)
      .map((id) => ({
        job_type: "youtube",
        url: `https://www.youtube.com/watch?v=${id}`,
        category: data.category,
        status: "pending",
      }));
    if (!rows.length) return { queued: 0, skipped: data.urls.length };
    const { error } = await supabaseAdmin.from("training_jobs").insert(rows);
    if (error) throw new Error(error.message);
    return { queued: rows.length, skipped: data.urls.length - rows.length };
  });

export const processYoutubeJobsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ limit: z.number().min(1).max(20).default(5) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pendingJobs } = await supabaseAdmin
      .from("training_jobs")
      .select("id, url, category")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(data.limit);

    if (!pendingJobs?.length) return { processed: 0, failed: 0, message: "처리할 작업이 없습니다." };

    const ids = pendingJobs.map((j) => j.id);
    await supabaseAdmin.from("training_jobs").update({ status: "processing" }).in("id", ids);

    let processed = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      try {
        const videoId = extractYoutubeId(job.url);
        if (!videoId) throw new Error("유효하지 않은 유튜브 URL");

        const { YoutubeTranscript } = await import("youtube-transcript");
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" }).catch(() =>
          YoutubeTranscript.fetchTranscript(videoId)
        );
        const transcriptText = items.map((t: { text: string }) => t.text).join(" ").slice(0, 6000);

        if (!transcriptText.trim()) throw new Error("자막을 가져올 수 없습니다 (자막 비활성화 영상)");

        const { cerebrasChat } = await import("./cerebras.server");
        const raw = await cerebrasChat({
          messages: [
            {
              role: "system",
              content: `너는 한국 입시 교육 전문가다. 유튜브 자막을 분석해 핵심 입시 정보를 정리한다.
반드시 아래 JSON 형식 하나만 출력. 다른 텍스트 없음.
{"title":"제목(50자 이내)","content":"핵심 내용 정리(500~1500자, 불릿 포인트 포함)"}`,
            },
            {
              role: "user",
              content: `URL: ${job.url}\n\n자막:\n${transcriptText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        });

        const m = raw.match(/\{[\s\S]*\}/);
        const parsed = m ? (JSON.parse(m[0]) as { title: string; content: string }) : null;

        const { data: doc, error: docErr } = await supabaseAdmin
          .from("training_docs")
          .insert({
            category: job.category,
            title: parsed?.title ?? `유튜브: ${job.url}`,
            content: parsed?.content ?? transcriptText,
            source_type: "youtube",
            source_url: job.url,
          })
          .select("id")
          .single();

        if (docErr) throw new Error(docErr.message);

        await supabaseAdmin
          .from("training_jobs")
          .update({ status: "done", doc_id: doc.id, processed_at: new Date().toISOString() })
          .eq("id", job.id);

        processed++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "처리 실패";
        await supabaseAdmin
          .from("training_jobs")
          .update({ status: "failed", error: errMsg, processed_at: new Date().toISOString() })
          .eq("id", job.id);
        failed++;
      }
    }

    return { processed, failed, message: `완료 ${processed}개, 실패 ${failed}개` };
  });

export const ingestUrlFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      url: z.string().url("올바른 URL을 입력해주세요"),
      category: z.string().min(1).max(60),
    }),
  )
  .handler(async ({ data }) => {
    const res = await fetch(data.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`페이지를 가져올 수 없습니다 (HTTP ${res.status})`);

    const html = await res.text();
    const rawText = stripHtml(html).slice(0, 8000);

    if (rawText.length < 50) throw new Error("페이지에서 텍스트를 추출할 수 없습니다.");

    const { cerebrasChat } = await import("./cerebras.server");
    const raw = await cerebrasChat({
      messages: [
        {
          role: "system",
          content: `너는 한국 입시 교육 전문가다. 웹 페이지 내용을 분석해 입시 관련 핵심 정보를 추출·정리한다.
반드시 아래 JSON 형식 하나만 출력. 다른 텍스트 없음.
{"title":"제목(50자 이내)","content":"핵심 내용 정리(500~2000자, 구조화된 설명 포함)"}`,
        },
        {
          role: "user",
          content: `URL: ${data.url}\n\n내용:\n${rawText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });

    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? (JSON.parse(m[0]) as { title: string; content: string }) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("training_docs")
      .insert({
        category: data.category,
        title: parsed?.title ?? data.url,
        content: parsed?.content ?? rawText.slice(0, 5000),
        source_type: "url",
        source_url: data.url,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: doc.id as string, title: parsed?.title ?? data.url };
  });

export const ingestPdfFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(1),
      filename: z.string().min(1).max(200),
      category: z.string().min(1).max(60),
    }),
  )
  .handler(async ({ data }) => {
    const pdfParse = (await import("pdf-parse")).default;

    const buffer = Buffer.from(data.base64, "base64");
    const parsed = await pdfParse(buffer, { max: 0 });
    const rawText = parsed.text.replace(/\s+/g, " ").trim().slice(0, 8000);

    if (rawText.length < 20) throw new Error("PDF에서 텍스트를 추출할 수 없습니다. (이미지 기반 PDF는 미지원)");

    const { cerebrasChat } = await import("./cerebras.server");
    const raw = await cerebrasChat({
      messages: [
        {
          role: "system",
          content: `너는 한국 입시 교육 전문가다. PDF 문서 내용을 분석해 입시 관련 핵심 정보를 추출·정리한다.
반드시 아래 JSON 형식 하나만 출력. 다른 텍스트 없음.
{"title":"제목(50자 이내)","content":"핵심 내용 정리(500~2000자, 구조화된 설명 포함)"}`,
        },
        {
          role: "user",
          content: `파일명: ${data.filename}\n\nPDF 내용:\n${rawText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });

    const m = raw.match(/\{[\s\S]*\}/);
    const result = m ? (JSON.parse(m[0]) as { title: string; content: string }) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("training_docs")
      .insert({
        category: data.category,
        title: result?.title ?? data.filename,
        content: result?.content ?? rawText.slice(0, 5000),
        source_type: "pdf",
        source_url: null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: doc.id as string, title: result?.title ?? data.filename };
  });

export const ingestImageFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      base64: z.string().min(1),
      mimeType: z.string().min(1),
      filename: z.string().min(1).max(200),
      category: z.string().min(1).max(60),
      userDescription: z.string().max(5000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { cerebrasChat } = await import("./cerebras.server");

    const prompt = data.userDescription
      ? `파일명: ${data.filename}\n\n관리자 설명:\n${data.userDescription}`
      : `파일명: ${data.filename}\n\n(이미지 파일입니다. 파일명과 관련 입시 맥락을 추정해 내용을 정리해주세요.)`;

    const raw = await cerebrasChat({
      messages: [
        {
          role: "system",
          content: `너는 한국 입시 교육 전문가다. 주어진 정보를 바탕으로 입시 관련 학습 자료를 정리한다.
반드시 아래 JSON 형식 하나만 출력. 다른 텍스트 없음.
{"title":"제목(50자 이내)","content":"핵심 내용 정리(300~1500자)"}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const m = raw.match(/\{[\s\S]*\}/);
    const result = m ? (JSON.parse(m[0]) as { title: string; content: string }) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("training_docs")
      .insert({
        category: data.category,
        title: result?.title ?? data.filename,
        content: result?.content ?? data.userDescription ?? data.filename,
        source_type: "image",
        source_url: null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: doc.id as string, title: result?.title ?? data.filename };
  });

export const listTrainingJobsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: jobs } = await supabaseAdmin
      .from("training_jobs")
      .select("id, url, status, error, category, created_at, processed_at, doc_id")
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: counts } = await supabaseAdmin
      .from("training_jobs")
      .select("status");
    const summary = { pending: 0, processing: 0, done: 0, failed: 0 } as Record<string, number>;
    for (const r of counts ?? []) summary[r.status] = (summary[r.status] ?? 0) + 1;
    return { jobs: jobs ?? [], summary };
  });

export const cancelTrainingJobFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("training_jobs")
      .update({ status: "cancelled", processed_at: new Date().toISOString(), error: "사용자 취소" })
      .eq("id", data.id)
      .in("status", ["pending", "processing", "failed"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTrainingJobFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("training_jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrainingDocsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("training_docs")
      .select("id, category, title, content, source_type, source_url, created_at")
      .order("created_at", { ascending: false });
    return { docs: data ?? [] };
  });

export const saveTrainingDocFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      category: z.string().min(1).max(60),
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(100000),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("training_docs")
        .update({ category: data.category, title: data.title, content: data.content })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("training_docs")
        .insert({ category: data.category, title: data.title, content: data.content, source_type: "manual" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    }
  });

export const deleteTrainingDocFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_docs").delete().eq("id", data.id);
    return { ok: true };
  });

export const clearFailedJobsFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("training_jobs").delete().in("status", ["done", "failed"]);
    return { ok: true };
  });
