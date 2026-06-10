import { supabase } from "@/integrations/supabase/client";

/**
 * 사용자 계정과 연결된 localStorage 데이터를 Supabase user_data 테이블에 동기화.
 * "navi." 로 시작하는 모든 키를 자동으로 클라우드에 저장하고, 로그인 시 복원한다.
 */

const PREFIX = "navi.";
const HYDRATED_FLAG = "__navi_cloud_hydrated_for__";
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let installed = false;
let currentUserId: string | null = null;

function isSyncedKey(key: string | null | undefined): key is string {
  return typeof key === "string" && key.startsWith(PREFIX);
}

async function pushKey(userId: string, key: string, rawValue: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    // 일반 문자열도 jsonb에 저장될 수 있게 그대로 감싼다.
    parsed = rawValue;
  }
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, key, value: parsed as never }, { onConflict: "user_id,key" });
  if (error) console.warn("[cloud-sync] upsert 실패", key, error.message);
}

function schedulePush(key: string, rawValue: string) {
  if (!currentUserId) return;
  const userId = currentUserId;
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      void pushKey(userId, key, rawValue);
    }, 600),
  );
}

async function deleteKey(userId: string, key: string) {
  const { error } = await supabase
    .from("user_data")
    .delete()
    .eq("user_id", userId)
    .eq("key", key);
  if (error) console.warn("[cloud-sync] delete 실패", key, error.message);
}

function installLocalStorageHooks() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;

  Storage.prototype.setItem = function (key: string, value: string) {
    origSet.call(this, key, value);
    if (this === window.localStorage && isSyncedKey(key)) {
      schedulePush(key, value);
    }
  };

  Storage.prototype.removeItem = function (key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && isSyncedKey(key) && currentUserId) {
      void deleteKey(currentUserId, key);
    }
  };
}

async function hydrateFromCloud(userId: string) {
  if (typeof window === "undefined") return;
  const flagKey = HYDRATED_FLAG + userId;
  const already = sessionStorage.getItem(flagKey);
  const { data, error } = await supabase
    .from("user_data")
    .select("key, value")
    .eq("user_id", userId);
  if (error) {
    console.warn("[cloud-sync] hydrate 실패", error.message);
    return;
  }
  if (!data) return;

  let changed = false;
  // 클라우드 → 로컬 (덮어쓰기)
  for (const row of data) {
    const key = row.key as string;
    if (!isSyncedKey(key)) continue;
    const value = row.value;
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (window.localStorage.getItem(key) !== serialized) {
      // 원본 setItem 사용 — 클라우드 재업로드 방지
      Storage.prototype.setItem.call(window.localStorage, key, serialized);
      changed = true;
    }
  }

  // 로컬에만 있는 navi.* 키는 클라우드로 업로드 (첫 로그인 시 기존 데이터 보존)
  if (!already) {
    const cloudKeys = new Set(data.map((r) => r.key as string));
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!isSyncedKey(k) || cloudKeys.has(k)) continue;
      const v = window.localStorage.getItem(k);
      if (v != null) await pushKey(userId, k, v);
    }
    sessionStorage.setItem(flagKey, "1");
  }

  if (changed) {
    // 컴포넌트들이 새 데이터를 읽도록 알림 + 첫 로그인 시 1회 새로고침
    window.dispatchEvent(new Event("navi:cloud-hydrated"));
    const reloadFlag = "__navi_cloud_reloaded_for__" + userId;
    if (!sessionStorage.getItem(reloadFlag)) {
      sessionStorage.setItem(reloadFlag, "1");
      window.location.reload();
    }
  }
}

function clearLocalSyncedKeys() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (isSyncedKey(k)) keys.push(k);
  }
  for (const k of keys) Storage.prototype.removeItem.call(window.localStorage, k);
  // sessionStorage hydrated flags clear
  const sessionKeys: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    if (k && k.startsWith(HYDRATED_FLAG)) sessionKeys.push(k);
  }
  for (const k of sessionKeys) window.sessionStorage.removeItem(k);
}

export function initCloudSync() {
  if (typeof window === "undefined") return;
  installLocalStorageHooks();

  // 현재 세션 확인 후 즉시 hydrate
  void supabase.auth.getSession().then(({ data }) => {
    const uid = data.session?.user.id ?? null;
    currentUserId = uid;
    if (uid) void hydrateFromCloud(uid);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user.id ?? null;
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      if (uid && uid !== currentUserId) {
        currentUserId = uid;
        void hydrateFromCloud(uid);
      } else if (uid) {
        currentUserId = uid;
      }
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
      clearLocalSyncedKeys();
      window.dispatchEvent(new Event("navi:cloud-hydrated"));
    } else if (event === "USER_UPDATED" && uid) {
      currentUserId = uid;
    }
  });
}