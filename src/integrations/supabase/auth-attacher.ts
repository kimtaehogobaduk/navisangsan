import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

const supabaseUrl = typeof import.meta !== "undefined"
  ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  : undefined;
const hasSupabase = !!supabaseUrl;

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!hasSupabase) {
      return next({ headers: {} });
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return next({
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    });
  },
);
