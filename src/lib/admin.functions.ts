import { createServerFn } from "@tanstack/react-start";

const ADMIN_PASSCODE = "sangsanadmin";

export const listAllUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersErr) throw new Error(usersErr.message);

    const users = usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
    }));

    // user_data 테이블이 없으면 빈 배열로 처리 (graceful fallback)
    let rows: Array<{ user_id: string; key: string; updated_at: string }> = [];
    try {
      const { data: rowData, error: rowsErr } = await supabaseAdmin
        .from("user_data")
        .select("user_id, key, updated_at");
      if (rowsErr) {
        // 테이블이 없거나 스키마 캐시 오류면 빈 배열로 계속
        if (!rowsErr.message.includes("does not exist") && !rowsErr.message.includes("schema cache")) {
          throw new Error(rowsErr.message);
        }
        console.warn("[admin] user_data 테이블 없음 — 활동 통계 건너뜀:", rowsErr.message);
      } else {
        rows = rowData ?? [];
      }
    } catch (e) {
      console.warn("[admin] user_data 조회 실패:", e instanceof Error ? e.message : e);
    }

    const activityMap = new Map<string, { count: number; lastActive: string | null; keys: string[] }>();
    for (const r of rows) {
      const entry = activityMap.get(r.user_id) ?? { count: 0, lastActive: null, keys: [] };
      entry.count += 1;
      if (!entry.lastActive || new Date(r.updated_at) > new Date(entry.lastActive)) entry.lastActive = r.updated_at;
      if (!entry.keys.includes(r.key)) entry.keys.push(r.key);
      activityMap.set(r.user_id, entry);
    }

    return {
      users: users.map((u) => {
        const act = activityMap.get(u.id);
        return { ...u, activity_count: act?.count ?? 0, last_active_at: act?.lastActive ?? null, activity_keys: act?.keys ?? [] };
      }),
    };
  });

export const getUserActivityDetailFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string; userId: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("user_data")
        .select("key, value, updated_at")
        .eq("user_id", data.userId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (error.message.includes("does not exist") || error.message.includes("schema cache")) {
          return { rows: [] };
        }
        throw new Error(error.message);
      }
      return { rows: rows ?? [] };
    } catch (e) {
      if (e instanceof Error && (e.message.includes("does not exist") || e.message.includes("schema cache"))) {
        return { rows: [] };
      }
      throw e;
    }
  });

export const checkSupabaseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = ["training_docs", "training_jobs", "school_research", "admissions_info", "user_data"] as const;
    const results: Record<string, { exists: boolean; count?: number }> = {};
    for (const table of tables) {
      const { count, error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
      if (error) {
        results[table] = { exists: false };
      } else {
        results[table] = { exists: true, count: count ?? 0 };
      }
    }
    return { tables: results };
  });

export const triggerAutoCollectFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");
    const { triggerManualCollection } = await import("@/lib/auto-collector.server");
    return triggerManualCollection();
  });

export const triggerAdmissionsRefreshFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");
    const { triggerManualRefresh } = await import("@/lib/admissions.worker");
    triggerManualRefresh().catch(console.error);
    return { ok: true, message: "입시 정보 갱신을 시작했습니다." };
  });
