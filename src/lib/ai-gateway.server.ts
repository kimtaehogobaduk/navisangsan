import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey, // required by SDK type, not sent as Bearer
    headers: {
      "Lovable-API-Key": apiKey,
    },
  });
}
