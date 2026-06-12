// Lightweight DB helpers backed by Supabase (Lovable Cloud).
// The legacy `pg` direct-Pool path was removed because Lovable Cloud already
// exposes Supabase, and the required tables are provisioned via migrations.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
    }
    _admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}

/** Legacy stub — pg Pool is no longer used. Kept to satisfy old imports. */
export function getPool(): never {
  throw new Error("getPool()은 더 이상 지원되지 않습니다. supabaseAdmin을 사용하세요.");
}

export async function query<T = Record<string, unknown>>(): Promise<T[]> {
  throw new Error("query()는 더 이상 지원되지 않습니다. supabaseAdmin을 사용하세요.");
}

export async function queryOne<T = Record<string, unknown>>(): Promise<T | null> {
  throw new Error("queryOne()은 더 이상 지원되지 않습니다. supabaseAdmin을 사용하세요.");
}

/** Tables are created via Supabase migrations — initDb is now a no-op. */
export async function initDb(): Promise<void> {
  // intentionally empty
}

export type AdmissionsRow = {
  id: number;
  topic_key: string;
  title: string;
  summary: string;
  bullets: string[];
  target_grade: string;
  universities: string[];
  info_type: string;
  importance: number;
  fetched_at: string;
  created_at: string;
};

export async function upsertAdmissionsInfo(
  items: {
    topic_key: string;
    title: string;
    summary: string;
    bullets: string[];
    target_grade: string;
    universities: string[];
    info_type: string;
    importance: number;
  }[],
): Promise<void> {
  if (!items.length) return;
  const rows = items.map((i) => ({
    topic_key: i.topic_key,
    title: i.title,
    summary: i.summary,
    bullets: i.bullets,
    target_grade: i.target_grade,
    universities: i.universities,
    info_type: i.info_type,
    importance: i.importance,
    fetched_at: new Date().toISOString(),
  }));
  const { error } = await admin()
    .from("admissions_info")
    .upsert(rows, { onConflict: "topic_key" });
  if (error) throw new Error(`upsertAdmissionsInfo: ${error.message}`);
}

export async function getAllAdmissionsInfo(): Promise<AdmissionsRow[]> {
  const { data, error } = await admin()
    .from("admissions_info")
    .select("*")
    .order("importance", { ascending: false })
    .order("fetched_at", { ascending: false });
  if (error) throw new Error(`getAllAdmissionsInfo: ${error.message}`);
  return (data ?? []) as AdmissionsRow[];
}

export async function getLastFetchedAt(): Promise<Date | null> {
  const { data, error } = await admin()
    .from("admissions_info")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.fetched_at ? new Date(data.fetched_at as string) : null;
}
