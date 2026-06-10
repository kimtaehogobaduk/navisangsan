import { createFileRoute } from "@tanstack/react-router";
import { YoutubeTranscript } from "youtube-transcript";
import { Innertube } from "youtubei.js";

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

type VideoData = {
  title: string;
  channel: string;
  description: string;
  transcript: string;
  hasTranscript: boolean;
  keywords?: string[];
  publishDate?: string;
  category?: string;
};

function decodeHtmlJson(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0025/g, "%")
    .replace(/\\\//g, "/");
}

async function fetchTranscriptFromWatchPage(videoId: string): Promise<Partial<VideoData> | null> {
  try {
    const html = await (await fetch(`https://www.youtube.com/watch?v=${videoId}`)).text();
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/);
    if (!playerMatch) return null;
    const player = JSON.parse(playerMatch[1]) as {
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> } };
      microformat?: { playerMicroformatRenderer?: { category?: string; publishDate?: string; ownerChannelName?: string; title?: { simpleText?: string }; description?: { simpleText?: string } } };
      videoDetails?: { title?: string; author?: string; shortDescription?: string; keywords?: string[] };
    };

    const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const preferred = tracks.find((t) => t.languageCode === "ko" && t.kind === "asr")
      ?? tracks.find((t) => t.languageCode === "ko")
      ?? tracks.find((t) => t.kind === "asr")
      ?? tracks[0];

    let transcript = "";
    if (preferred?.baseUrl) {
      const url = decodeHtmlJson(preferred.baseUrl) + "&fmt=srv3";
      const xml = await (await fetch(url)).text();
      transcript = Array.from(xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g))
        .map((m) => m[1]
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/<[^>]+>/g, " ")
        )
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const micro = player.microformat?.playerMicroformatRenderer;
    const details = player.videoDetails;
    return {
      title: details?.title ?? micro?.title?.simpleText ?? videoId,
      channel: details?.author ?? micro?.ownerChannelName ?? "",
      description: details?.shortDescription ?? micro?.description?.simpleText ?? "",
      transcript,
      hasTranscript: transcript.length >= 50,
      keywords: details?.keywords ?? [],
      publishDate: micro?.publishDate,
      category: micro?.category,
    };
  } catch (e) {
    console.warn("[watch-page transcript] failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function fetchViaInnertube(videoId: string): Promise<VideoData | null> {
  try {
    const yt = await Innertube.create({ lang: "ko", location: "KR", retrieve_player: false });
    const info = await yt.getInfo(videoId);
    const title = info.basic_info.title ?? videoId;
    const channel = info.basic_info.author ?? "";
    const description = info.basic_info.short_description ?? "";
    const keywords = info.basic_info.keywords ?? [];
    const category = info.basic_info.category ?? "";

    let transcript = "";
    try {
      const t = await info.getTranscript();
      const segs = t?.transcript?.content?.body?.initial_segments ?? [];
      transcript = segs
        .map((s) => (s as { snippet?: { text?: string } }).snippet?.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      // 자막 트랙 없음 (자동 생성도 없음)
    }

    return {
      title,
      channel,
      description,
      transcript,
      hasTranscript: transcript.length >= 50,
      keywords,
      category,
    };
  } catch (e) {
    console.warn("[innertube] failed", e instanceof Error ? e.message : e);
    return null;
  }
}

async function summarizeWithAI(opts: {
  title: string;
  channel: string;
  description: string;
  transcript: string;
  hasTranscript: boolean;
  keywords?: string[];
  publishDate?: string;
  category?: string;
}): Promise<string> {
  const { cerebrasResearchChat } = await import("@/lib/cerebras.server");
  const sourceNote = opts.hasTranscript
    ? "자막 전문이 제공된다."
    : "자막이 없으므로 제목·채널·영상 설명(description)만으로 추론한다. 설명에 없는 사실은 절대 지어내지 말고, 추론한 부분은 '추정' 표기.";
  const sys = `너는 한국 입시/교육 영상 요약 전문가다. 학생/학부모/입시컨설턴트가 참고할 핵심 지식을 한국어로 추출한다.
${sourceNote}
규칙:
- 마크다운 출력.
- ## 핵심 요약 (3~5줄)
- ## 주요 인사이트 (불릿 6~10개, 입시 전략/대학별 정보/세특/과목 학습법 등 구체적 사실)
- ## 학생 액션 아이템 (체크박스 4~6개)
- 소스에 없는 내용 지어내지 말 것.`;
  const body = opts.hasTranscript
    ? `[자막]\n${opts.transcript.slice(0, 18000)}`
    : `[영상 설명]\n${opts.description.slice(0, 8000)}`;
  const user = `[영상] ${opts.title}\n[채널] ${opts.channel}\n[카테고리] ${opts.category ?? ""}\n[게시일] ${opts.publishDate ?? ""}\n[키워드] ${(opts.keywords ?? []).join(", ")}\n\n${body}`;
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

    // 1차: youtubei.js (자동 생성 자막 + 메타 + 설명 모두 가져옴)
    let video = await fetchViaInnertube(id);

    // 2차: watch page 직접 파싱 (자동자막/설명/키워드)
    if (!video || !video.hasTranscript) {
      const watchPageVideo = await fetchTranscriptFromWatchPage(id);
      if (watchPageVideo && ((watchPageVideo.transcript?.length ?? 0) > (video?.transcript.length ?? 0) || !video)) {
        video = {
          title: watchPageVideo.title ?? video?.title ?? id,
          channel: watchPageVideo.channel ?? video?.channel ?? "",
          description: watchPageVideo.description ?? video?.description ?? "",
          transcript: watchPageVideo.transcript ?? video?.transcript ?? "",
          hasTranscript: watchPageVideo.hasTranscript ?? video?.hasTranscript ?? false,
          keywords: watchPageVideo.keywords ?? video?.keywords,
          publishDate: watchPageVideo.publishDate ?? video?.publishDate,
          category: watchPageVideo.category ?? video?.category,
        };
      }
    }

    // 3차: youtube-transcript + oembed 폴백
    if (!video || (!video.hasTranscript && video.description.trim().length < 20)) {
      const [meta, segs, watchPageVideo] = await Promise.all([
        fetchYoutubeMeta(id),
        YoutubeTranscript.fetchTranscript(id, { lang: "ko" })
          .catch(() => YoutubeTranscript.fetchTranscript(id).catch(() => [])),
        fetchTranscriptFromWatchPage(id),
      ]);
      const transcript = segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
      video = {
        title: watchPageVideo?.title ?? meta?.title ?? id,
        channel: watchPageVideo?.channel ?? meta?.channel ?? "",
        description: watchPageVideo?.description ?? "",
        transcript: transcript || watchPageVideo?.transcript || "",
        hasTranscript: transcript.length >= 50 || !!watchPageVideo?.hasTranscript,
        keywords: watchPageVideo?.keywords ?? [],
        publishDate: watchPageVideo?.publishDate,
        category: watchPageVideo?.category,
      };
    }

    const { data: latestJob } = await supabaseAdmin
      .from("training_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (latestJob?.status === "cancelled") return;

    // 자막도 설명도 둘 다 거의 없으면 진짜 정보가 없는 케이스
    if (!video.hasTranscript && video.description.trim().length < 20 && (video.keywords?.length ?? 0) < 3) {
      throw new Error("자막과 설명이 모두 비어있어 추출할 정보가 없습니다.");
    }

    const summary = await summarizeWithAI(video);
    const sourceTag = video.hasTranscript ? "자막 기반" : "설명/메타 기반";
    const content = `[채널] ${video.channel}\n[URL] ${job.url}\n[소스] ${sourceTag}\n[카테고리] ${video.category ?? ""}\n[게시일] ${video.publishDate ?? ""}\n[키워드] ${(video.keywords ?? []).join(", ")}\n\n${summary}`;
    const { data: doc, error: insErr } = await supabaseAdmin
      .from("training_docs")
      .insert({
        category: job.category,
        title: video.title.slice(0, 200),
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