import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = typeof import.meta !== "undefined"
  ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  : undefined;
const hasSupabase = !!supabaseUrl;

const USER_DATA_PREFIX = "navi.user.";

async function pushLocalDataToCloud(userId: string) {
  if (typeof window === "undefined") return;
  try {
    const pairs: Array<{ user_id: string; key: string; value: unknown }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(USER_DATA_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (raw == null) continue;
      try {
        pairs.push({ user_id: userId, key: k.slice(USER_DATA_PREFIX.length), value: JSON.parse(raw) });
      } catch {
        pairs.push({ user_id: userId, key: k.slice(USER_DATA_PREFIX.length), value: raw });
      }
    }
    if (!pairs.length) return;
    await supabase.from("user_data").upsert(pairs, { onConflict: "user_id,key" } as unknown as undefined);
  } catch (e) {
    console.warn("[cloud-sync] push 실패:", e);
  }
}

export function initCloudSync() {
  if (typeof window === "undefined" || !hasSupabase) return;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user?.id) {
      pushLocalDataToCloud(session.user.id).catch(console.warn);
    }
  });
}
