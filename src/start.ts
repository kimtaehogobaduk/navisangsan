import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));

if (typeof window === "undefined") {
  import("@/lib/db.server").then(({ initDb }) => initDb()).catch(console.error);
  import("@/lib/auto-collector.server")
    .then(({ startAutoCollector }) => startAutoCollector())
    .catch(console.error);
}
