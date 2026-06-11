import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const hasSupabase = !!(supabaseUrl && supabaseKey);

// ─── No-op stub (used when Supabase is not configured, e.g. Replit) ────────

const noopClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: async (_opts: { email: string; password: string }) => ({
      data: null,
      error: { message: "이메일 로그인을 사용하려면 Supabase를 연결해주세요." },
    }),
    signUp: async (_opts: unknown) => ({
      data: null,
      error: { message: "회원가입을 사용하려면 Supabase를 연결해주세요." },
    }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async (_email: string) => ({ error: null }),
  },
  from: (_table: string) => ({
    select: (_cols?: string) => ({
      eq: (_col: string, _val: unknown) =>
        Promise.resolve({ data: [] as unknown[], error: null }),
      data: [] as unknown[],
      error: null,
    }),
    upsert: async (_data: unknown, _opts?: unknown) => ({ error: null }),
    delete: () => ({
      eq: (_col: string, _val: unknown) =>
        Promise.resolve({ error: null }),
    }),
  }),
};

// ─── Export ────────────────────────────────────────────────────────────────

export const supabase = hasSupabase
  ? createClient(supabaseUrl!, supabaseKey!)
  : (noopClient as ReturnType<typeof createClient>);
