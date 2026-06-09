// Server-only Cerebras client. Never import from client modules.
// Cerebras Inference API is OpenAI-compatible.

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
export const CEREBRAS_MODEL = "gpt-oss-120b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function cerebrasChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}): Promise<string> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY is not configured");

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

    let providerMessage = errText;
    try {
      const parsed = JSON.parse(errText) as { message?: string };
      providerMessage = parsed.message ?? errText;
    } catch {
      providerMessage = errText;
    }

    if (res.status === 402) {
      throw new Error(
        "Cerebras 결제 또는 크레딧이 없어 AI 기능을 실행할 수 없습니다. Cerebras 빌링을 활성화한 뒤 다시 시도해 주세요.",
      );
    }

    if (res.status === 401) {
      throw new Error("Cerebras API 키가 유효하지 않습니다. 키 설정을 확인해 주세요.");
    }

    if (res.status === 429) {
      throw new Error("Cerebras 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    }

    throw new Error(
      `Cerebras 호출에 실패했습니다 (${res.status}). ${providerMessage.slice(0, 220)}`,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
