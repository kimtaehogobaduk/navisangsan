import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = typeof import.meta !== "undefined"
  ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  : undefined;
const hasSupabase = !!supabaseUrl;

const USER_DATA_PREFIX = "navi.user.";

/** 로컬 → 클라우드 push */
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

/** 클라우드 → 로컬 pull (다른 기기에서 로그인 시 데이터 복원) */
async function pullCloudDataToLocal(userId: string) {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase
      .from("user_data")
      .select("key, value, updated_at")
      .eq("user_id", userId);
    if (!data?.length) return;
    for (const row of data as Array<{ key: string; value: unknown }>) {
      const localKey = `${USER_DATA_PREFIX}${row.key}`;
      const serialized = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
      // 로컬이 비었을 때만 덮어씀. 로컬 우선(현재 기기에서 편집 중인 값 보호)
      if (!localStorage.getItem(localKey)) {
        localStorage.setItem(localKey, serialized);
      }
    }
    window.dispatchEvent(new Event("navi:cloud-synced"));
  } catch (e) {
    console.warn("[cloud-sync] pull 실패:", e);
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;

/** 로컬 storage 변경 감지 → debounce 후 push */
function attachAutoPush() {
  if (typeof window === "undefined") return;
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    origSetItem(key, value);
    if (!currentUserId || !key.startsWith(USER_DATA_PREFIX)) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (currentUserId) pushLocalDataToCloud(currentUserId).catch(console.warn);
    }, 2000);
  };
}

export function initCloudSync() {
  if (typeof window === "undefined" || !hasSupabase) return;

  attachAutoPush();

  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user?.id) {
      currentUserId = data.session.user.id;
      pullCloudDataToLocal(currentUserId).then(() => {
        if (currentUserId) pushLocalDataToCloud(currentUserId).catch(console.warn);
      });
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user?.id) {
      currentUserId = session.user.id;
      // pull 먼저 (다른 기기 데이터 복원), 그 다음 push
      pullCloudDataToLocal(currentUserId).then(() => {
        if (currentUserId) pushLocalDataToCloud(currentUserId).catch(console.warn);
      });
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
    }
  });
}
