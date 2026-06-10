// Backed by Supabase (Lovable Cloud). No direct pg connection.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function initDb() {
  // Table is managed via Supabase migrations. No-op.
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

export async function upsertAdmissionsInfo(items: {
  topic_key: string;
  title: string;
  summary: string;
  bullets: string[];
  target_grade: string;
  universities: string[];
  info_type: string;
  importance: number;
}[]) {
  if (!items.length) return;
  const rows = items.map((i) => ({ ...i, fetched_at: new Date().toISOString() }));
  const { error } = await supabaseAdmin
    .from("admissions_info")
    .upsert(rows, { onConflict: "topic_key" });
  if (error) throw new Error(error.message);
}

export async function getAllAdmissionsInfo(): Promise<AdmissionsRow[]> {
  const { data, error } = await supabaseAdmin
    .from("admissions_info")
    .select("*")
    .order("importance", { ascending: false })
    .order("fetched_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdmissionsRow[];
}

export async function getLastFetchedAt(): Promise<Date | null> {
  const { data, error } = await supabaseAdmin
    .from("admissions_info")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const v = data?.[0]?.fetched_at;
  return v ? new Date(v) : null;
}
