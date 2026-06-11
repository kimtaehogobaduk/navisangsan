import { createServerFn } from "@tanstack/react-start";

const ADMIN_PASSCODE = "sangsanadmin";

export const listAllUsersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) {
      throw new Error("관리자 인증 실패");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // List all users (paginated; up to 1000)
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersErr) throw new Error(usersErr.message);

    const users = usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
    }));

    // Pull all user_data rows to compute activity
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("user_data")
      .select("user_id, key, updated_at");
    if (rowsErr) throw new Error(rowsErr.message);

    const activityMap = new Map<string, { count: number; lastActive: string | null; keys: string[] }>();
    for (const r of rows ?? []) {
      const entry = activityMap.get(r.user_id) ?? { count: 0, lastActive: null, keys: [] };
      entry.count += 1;
      if (!entry.lastActive || new Date(r.updated_at) > new Date(entry.lastActive)) {
        entry.lastActive = r.updated_at;
      }
      if (!entry.keys.includes(r.key)) entry.keys.push(r.key);
      activityMap.set(r.user_id, entry);
    }

    return {
      users: users.map((u) => {
        const act = activityMap.get(u.id);
        return {
          ...u,
          activity_count: act?.count ?? 0,
          last_active_at: act?.lastActive ?? null,
          activity_keys: act?.keys ?? [],
        };
      }),
    };
  });

export const getUserActivityDetailFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string; userId: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) {
      throw new Error("관리자 인증 실패");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_data")
      .select("key, value, updated_at")
      .eq("user_id", data.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
