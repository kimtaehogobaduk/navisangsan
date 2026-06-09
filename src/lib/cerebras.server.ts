// Server-only Cerebras client. Never import from client modules.
// Cerebras Inference API is OpenAI-compatible.

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
export const CEREBRAS_MODEL = "gpt-oss-120b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Returns all configured API keys in priority order. */
function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = i === 1
      ? process.env.CEREBRAS_API_KEY
      : process.env[`CEREBRAS_API_KEY_${i}`];
    if (key?.trim()) keys.push(key.trim());
  }
  return keys;
}

async function callOnce(
  apiKey: string,
  opts: { messages: ChatMessage[]; temperature?: number; max_tokens?: number },
): Promise<{ ok: true; content: string } | { ok: false; status: number; message: string }> {
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
      max_tokens: opts.max_tokens ?? 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try { msg = (JSON.parse(errText) as { message?: string }).message ?? errText; } catch { /* */ }
    return { ok: false, status: res.status, message: msg.slice(0, 220) };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { ok: true, content: json.choices?.[0]?.message?.content?.trim() ?? "" };
}

export async function cerebrasChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const keys = getApiKeys();
  if (!keys.length) throw new Error("CEREBRAS_API_KEY가 설정되지 않았습니다.");

  let lastError = "";

  for (let i = 0; i < keys.length; i++) {
    const result = await callOnce(keys[i], opts);

    if (result.ok) return result.content;

    const { status, message } = result;
    const keyLabel = i === 0 ? "기본 키" : `키 ${i + 1}번`;

    if (status === 402) {
      // Credits exhausted — try next key
      lastError = `${keyLabel} 크레딧 소진`;
      console.warn(`[Cerebras] ${keyLabel} 크레딧 소진, 다음 키로 전환 중…`);
      continue;
    }

    if (status === 401) {
      lastError = `${keyLabel} 유효하지 않음`;
      console.warn(`[Cerebras] ${keyLabel} 인증 실패, 다음 키로 전환 중…`);
      continue;
    }

    if (status === 429) {
      throw new Error("Cerebras 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    }

    throw new Error(`Cerebras 호출에 실패했습니다 (${status}). ${message}`);
  }

  throw new Error(
    `모든 Cerebras API 키가 소진되었습니다 (${lastError}). 새 키를 추가하거나 크레딧을 충전해주세요.`,
  );
}
