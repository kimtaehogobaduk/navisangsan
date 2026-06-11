// Server-only Groq client. Never import from client modules.
// Groq API is OpenAI-compatible. Used for web search + fast inference.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// llama-3.1-8b-instant: lowest token consumption, fast
export const GROQ_MODEL = "llama-3.1-8b-instant";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getGroqKeys(): string[] {
  const keys: string[] = [];
  const k1 = process.env.GROQ_API_KEY?.trim();
  const k2 = process.env.GROQ_API_KEY_2?.trim();
  if (k1) keys.push(k1);
  if (k2) keys.push(k2);
  for (let i = 3; i <= 10; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }
  return keys;
}

async function callGroqOnce(
  apiKey: string,
  opts: { messages: ChatMessage[]; temperature?: number; max_tokens?: number },
): Promise<{ ok: true; content: string } | { ok: false; status: number; message: string }> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.max_tokens ?? 4096,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try { msg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText; } catch { /* */ }
    return { ok: false, status: res.status, message: msg.slice(0, 300) };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { ok: true, content };
}

export async function groqChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const keys = getGroqKeys();
  if (!keys.length) throw new Error("GROQ_API_KEY가 설정되지 않았습니다.");

  for (let i = 0; i < keys.length; i++) {
    const result = await callGroqOnce(keys[i], opts);
    if (result.ok) return result.content;
    if (result.status === 429) {
      if (i < keys.length - 1) { await sleep(500); continue; }
    }
    if (result.status === 401 || result.status === 402) { continue; }
    if (i < keys.length - 1) continue;
    throw new Error(`Groq API 오류 (${result.status}): ${result.message}`);
  }

  // backoff retry with first key
  for (const wait of [2000, 5000]) {
    await sleep(wait);
    const result = await callGroqOnce(keys[0], opts);
    if (result.ok) return result.content;
  }
  throw new Error("Groq API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
}

// ── 웹 검색 (DuckDuckGo Instant Answer API + HTML scraping) ──
export async function groqWebSearch(query: string): Promise<string> {
  let webContext = "";

  try {
    // DuckDuckGo Instant Answer API (무료, 키 불필요)
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(8000) });
    if (ddgRes.ok) {
      const ddg = (await ddgRes.json()) as {
        AbstractText?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
        Answer?: string;
        Heading?: string;
      };
      const parts: string[] = [];
      if (ddg.Heading) parts.push(`제목: ${ddg.Heading}`);
      if (ddg.Answer) parts.push(`답변: ${ddg.Answer}`);
      if (ddg.AbstractText) parts.push(`요약: ${ddg.AbstractText}`);
      if (ddg.RelatedTopics?.length) {
        const topics = ddg.RelatedTopics
          .slice(0, 5)
          .map((t) => t.Text)
          .filter(Boolean)
          .join("\n- ");
        if (topics) parts.push(`관련 정보:\n- ${topics}`);
      }
      if (parts.length) webContext = parts.join("\n");
    }
  } catch { /* DuckDuckGo 실패 시 무시 */ }

  // Groq로 웹 검색 결과 + 자체 지식 통합 요약
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `너는 한국 입시 전문 리서처다. 주어진 검색 결과와 자체 지식을 결합해 정확하고 구체적인 최신 입시 정보를 한국어로 제공한다.
검색 결과가 없거나 부족하면 자체 최신 지식으로 보완한다. 항상 실용적이고 구체적인 정보를 제공할 것.`,
    },
    {
      role: "user",
      content: `검색 쿼리: ${query}\n\n${webContext ? `검색 결과:\n${webContext}\n\n` : ""}위 정보를 바탕으로 한국 입시 관련 핵심 정보를 정리해줘. 구체적인 수치, 대학명, 전형 정보 포함.`,
    },
  ];

  return groqChat({ messages, temperature: 0.2, max_tokens: 1500 });
}

// ── 입시 정보 심층 분석 (Groq 전용) ──
export async function groqAnalyzeAdmissions(topic: string): Promise<string> {
  return groqChat({
    messages: [
      {
        role: "system",
        content: `너는 한국 대입 전문 분석가다. 2024~2026학년도 기준 최신 입시 정보를 정확하게 분석한다.
항상 구체적인 수치(합격선, 경쟁률, 모집인원)와 전략적 조언을 포함한다. 한국어로 답변.`,
      },
      { role: "user", content: topic },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });
}
