import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

const hasSupabase = !!(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    let userId: string | null = null;
    let claims: Record<string, unknown> = {};

    if (hasSupabase) {
      const headers = getRequestHeaders() as unknown as Record<string, string | undefined>;
      const authHeader = headers["authorization"] ?? headers["Authorization"];
      const token = authHeader?.replace(/^Bearer\s+/i, "");

      if (token) {
        const { supabaseAdmin } = await import("./client.server");
        const { data } = await supabaseAdmin.auth.getClaims(token);
        if (data && typeof data === "object" && "claims" in data) {
          const c = (data as { claims: Record<string, unknown> }).claims;
          userId = (c.sub as string) ?? null;
          claims = c;
        }
      }
    }

    return next({ context: { userId, claims } });
  },
);
