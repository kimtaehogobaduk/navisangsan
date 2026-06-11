import { createMiddleware } from "@tanstack/react-start";
import { getHeaders } from "@tanstack/react-start/server";

const hasSupabase = !!(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!hasSupabase) {
      return next({ context: { userId: null, claims: {} } });
    }

    const headers = getHeaders();
    const token = headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    let userId: string | null = null;
    let claims: Record<string, unknown> = {};

    if (token) {
      const { supabaseAdmin } = await import("./client.server");
      const { data } = await supabaseAdmin.auth.getClaims(token);
      if (data && typeof data === "object" && "claims" in data) {
        const c = (data as { claims: Record<string, unknown> }).claims;
        userId = (c.sub as string) ?? null;
        claims = c;
      }
    }

    return next({ context: { userId, claims } });
  },
);
