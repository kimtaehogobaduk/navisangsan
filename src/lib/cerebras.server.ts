// Server-only Cerebras client. Never import from client modules.
// Cerebras Inference API is OpenAI-compatible.

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
export const CEREBRAS_MODEL = "gpt-oss-120b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns all configured API keys in priority order. */
function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const key = i === 1
      ? process.env.CEREBRAS_API_KEY
      : process.env[`CEREBRAS_API_KEY_${i}`];
    if (key?.trim()) keys.push(key.trim());
  }
  return keys;
}

/** 정보검색/리서치 전용 키. 일반 채팅 키와 분리해 rate limit 격리. */
function getResearchKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.CEREBRAS_RESEARCH_API_KEY?.trim();
  if (primary) keys.push(primary);
  for (let i = 2; i <= 20; i++) {
    const k = process.env[`CEREBRAS_RESEARCH_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }
  // fallback: 채팅 키로 폴백
  if (!keys.length) return getApiKeys();
  return keys;
}

export async function cerebrasResearchChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const keys = getResearchKeys();
  if (!keys.length) throw new Error("CEREBRAS_RESEARCH_API_KEY가 설정되지 않았습니다.");
  for (const key of keys) {
    const r = await callOnce(key, opts);
    if (r.ok) return r.content;
    if (r.status !== 429 && r.status !== 402 && r.status !== 401) {
      throw new Error(`Cerebras(research) 호출 실패 (${r.status}). ${r.message}`);
    }
    await sleep(500);
  }
  throw new Error("Cerebras 리서치 키가 모두 한도에 도달했습니다.");
}

async function callOnce(
  apiKey: string,
  opts: { messages: ChatMessage[]; temperature?: number; max_tokens?: number },
): Promise<{ ok: true; content: string; truncated?: boolean } | { ok: false; status: number; message: string }> {
  const res = await fetch(CEREBRAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.max_tokens ?? 8192,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try { msg = (JSON.parse(errText) as { message?: string }).message ?? errText; } catch { /* */ }
    return { ok: false, status: res.status, message: msg.slice(0, 220) };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };

  const choice = json.choices?.[0];
  const content = choice?.message?.content?.trim() ?? "";
  const truncated = choice?.finish_reason === "length";

  if (truncated) {
    console.warn(`[Cerebras] ⚠️ 응답이 max_tokens(${opts.max_tokens ?? 8192})에 의해 잘렸습니다. finish_reason=length`);
  }

  return { ok: true, content, truncated };
}

/**
 * 키 순환 전략:
 * - 402 / 401 → 즉시 다음 키로 전환
 * - 429 (rate limit) → 1초 대기 후 다음 키로 전환 (각 키는 독립적 rate limit 보유)
 *   마지막 키도 429면 동일 키로 최대 3회 재시도 (2s, 4s, 8s backoff)
 */
export async function cerebrasChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const keys = getApiKeys();
  if (!keys.length) throw new Error("CEREBRAS_API_KEY가 설정되지 않았습니다.");

  // Phase 1: try each key once (with a brief wait on 429 before switching)
  for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
    const keyLabel = keyIdx === 0 ? "기본 키" : `키 ${keyIdx + 1}번`;
    const result = await callOnce(keys[keyIdx], opts);

    if (result.ok) return result.content;

    const { status, message } = result;

    if (status === 429) {
      if (keyIdx < keys.length - 1) {
        console.warn(`[Cerebras] ${keyLabel} rate limit, 1초 대기 후 다음 키로 전환…`);
        await sleep(1000);
        continue;
      }
      console.warn(`[Cerebras] 모든 키 rate limit 도달, 지수 백오프 재시도 시작…`);
      break;
    }

    if (status === 402) {
      console.warn(`[Cerebras] ${keyLabel} 크레딧 소진, 다음 키로 전환…`);
      continue;
    }

    if (status === 401) {
      console.warn(`[Cerebras] ${keyLabel} 인증 실패, 다음 키로 전환…`);
      continue;
    }

    throw new Error(`Cerebras 호출에 실패했습니다 (${status}). ${message}`);
  }

  // Phase 2: all keys tried once and failed — retry first key with backoff
  const waits = [2000, 4000, 8000];
  for (let attempt = 0; attempt < waits.length; attempt++) {
    const wait = waits[attempt];
    console.warn(`[Cerebras] ${wait / 1000}초 대기 후 재시도 (${attempt + 1}/${waits.length})…`);
    await sleep(wait);

    const result = await callOnce(keys[0], opts);
    if (result.ok) return result.content;

    if (result.status !== 429) {
      throw new Error(`Cerebras 호출에 실패했습니다 (${result.status}). ${result.message}`);
    }
  }

  throw new Error(
    "Cerebras API 요청 한도를 초과했습니다. 잠시 후(1~2분) 다시 시도해주세요.",
  );
}
