import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { startAutoCollector } from "@/lib/auto-collector.server";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));

// 자동 입시 정보 수집기 시작 (서버 사이드에서만 실행)
if (typeof window === "undefined") {
  startAutoCollector().catch(console.error);
}
