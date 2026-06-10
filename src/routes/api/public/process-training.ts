import { createFileRoute } from "@tanstack/react-router";
import { YoutubeTranscript } from "youtube-transcript";

const BATCH = 5;
const MAX_ATTEMPTS = 3;

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchYoutubeMeta(videoId: string): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string; author_name?: string };
    return { title: j.title ?? videoId, channel: j.author_name ?? "" };
  } catch {
    return null;
  }
}

async function summarizeWithAI(title: string, channel: string, transcript: string): Promise<string> {
  const { cerebrasResearchChat } = await import("@/lib/cerebras.server");
  const sys = `너는 한국 입시/교육 영상 요약 전문가다. 주어진 유튜브 영상 자막을 학생/학부모/입시컨설턴트가 참고할 수 있도록 핵심 지식을 한국어로 추출한다.
규칙:
- 마크다운 출력.
- ## 핵심 요약 (3~5줄)
- ## 주요 인사이트 (불릿 6~10개, 입시 전략/대학별 정보/세특/과목 학습법 등 구체적 사실)
- ## 학생 액션 아이템 (체크박스 4~6개)
- 영상에 없는 내용 지어내지 말 것.`;
  const user = `[영상] ${title}\n[채널] ${channel}\n\n[자막]\n${transcript.slice(0, 18000)}`;
  return await cerebrasResearchChat({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });
}

async function processOne(job: { id: string; url: string; category: string; attempts: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("training_jobs")
    .update({ status: "processing", attempts: job.attempts + 1 })
    .eq("id", job.id);

  try {
    const id = extractYoutubeId(job.url);
    if (!id) throw new Error("유효한 유튜브 URL이 아닙니다.");

    const [meta, segments] = await Promise.all([
      fetchYoutubeMeta(id),
      YoutubeTranscript.fetchTranscript(id, { lang: "ko" }).catch(() =>
        YoutubeTranscript.fetchTranscript(id).catch(() => []),
      ),
    ]);
    const transcript = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
    if (!transcript || transcript.length < 50) throw new Error("자막을 가져올 수 없는 영상입니다.");

    const title = meta?.title ?? id;
    const channel = meta?.channel ?? "";
    const summary = await summarizeWithAI(title, channel, transcript);

    const content = `[채널] ${channel}\n[URL] ${job.url}\n\n${summary}`;
    const { data: doc, error: insErr } = await supabaseAdmin
      .from("training_docs")
      .insert({
        category: job.category,
        title: title.slice(0, 200),
        content,
        source_type: "youtube",
        source_url: job.url,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("training_jobs")
      .update({ status: "done", doc_id: doc.id, processed_at: new Date().toISOString(), error: null })
      .eq("id", job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const failed = job.attempts + 1 >= MAX_ATTEMPTS;
    await supabaseAdmin
      .from("training_jobs")
      .update({
        status: failed ? "failed" : "pending",
        error: msg.slice(0, 400),
        processed_at: failed ? new Date().toISOString() : null,
      })
      .eq("id", job.id);
  }
}

export const Route = createFileRoute("/api/public/process-training")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: jobs } = await supabaseAdmin
          .from("training_jobs")
          .select("id, url, category, attempts")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(BATCH);
        const list = (jobs ?? []) as Array<{ id: string; url: string; category: string; attempts: number }>;
        if (!list.length) return Response.json({ processed: 0 });
        // 순차 처리 (Cerebras rate limit 보호)
        for (const j of list) await processOne(j);
        return Response.json({ processed: list.length });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to process pending youtube jobs" }),
    },
  },
});