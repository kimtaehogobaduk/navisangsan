// Server-only Cerebras client. Never import from client modules.
// Cerebras Inference API is OpenAI-compatible.

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
export const CEREBRAS_MODEL = "llama3.3-70b";

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
    throw new Error(`Cerebras ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
