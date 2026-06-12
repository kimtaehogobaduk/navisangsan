import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn("[supabase] SUPABASE_URL/SERVICE_ROLE_KEY가 설정되지 않았습니다.");
}

export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL ?? "http://localhost:54321",
  SERVICE_KEY ?? "anon",
  { auth: { autoRefreshToken: false, persistSession: false } },
);
