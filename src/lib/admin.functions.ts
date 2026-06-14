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
      // head:true 는 없는 테이블도 에러를 안 내는 버그가 있음 → 실제 SELECT로 감지
      // user_data는 PK가 (user_id, key) 복합키라 id 컬럼이 없으므로 * 사용
      const col = table === "user_data" ? "user_id" : "id";
      const { error: selErr } = await supabaseAdmin.from(table).select(col).limit(1);
      const missing =
        selErr &&
        (selErr.message.includes("does not exist") ||
          selErr.message.includes("schema cache") ||
          selErr.code === "42P01" ||
          selErr.code === "PGRST204");
      if (missing) {
        results[table] = { exists: false };
      } else {
        const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
        results[table] = { exists: true, count: count ?? 0 };
      }
    }
    return { tables: results };
  });

export const runMigrationFn = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => d)
  .handler(async ({ data }) => {
    if (data.passcode !== ADMIN_PASSCODE) throw new Error("관리자 인증 실패");

    // Supabase Management API를 통한 DDL 실행
    const projectRef = (process.env.SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (!projectRef) throw new Error("SUPABASE_URL에서 프로젝트 ref를 파악할 수 없습니다.");

    const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
    if (!managementToken) {
      throw new Error(
        "SUPABASE_MANAGEMENT_TOKEN이 설정되지 않았습니다. " +
        "Supabase 대시보드 → Account → Access Tokens에서 토큰을 발급해 환경변수로 추가해주세요."
      );
    }

    const SQL = `
DO $$ BEGIN

-- ① admissions_info
CREATE TABLE IF NOT EXISTS public.admissions_info (
  id BIGSERIAL PRIMARY KEY,
  topic_key VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  bullets JSONB DEFAULT '[]'::jsonb,
  target_grade VARCHAR(50) NOT NULL DEFAULT '공통',
  universities JSONB DEFAULT '[]'::jsonb,
  info_type VARCHAR(100) NOT NULL DEFAULT '입시정보',
  importance INTEGER DEFAULT 3,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ② user_data
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ③ school_research
CREATE TABLE IF NOT EXISTS public.school_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_key text NOT NULL UNIQUE,
  school_name text NOT NULL,
  region text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ④ training_docs
CREATE TABLE IF NOT EXISTS public.training_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ⑤ training_jobs
CREATE TABLE IF NOT EXISTS public.training_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL DEFAULT 'youtube',
  url text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  status text NOT NULL DEFAULT 'pending',
  error text,
  doc_id uuid REFERENCES public.training_docs(id) ON DELETE SET NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS training_jobs_status_idx ON public.training_jobs(status, created_at);

END $$;

-- Grants
GRANT SELECT ON public.admissions_info TO anon, authenticated;
GRANT ALL ON public.admissions_info TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
GRANT ALL ON public.user_data TO service_role;
GRANT SELECT ON public.school_research TO authenticated, anon;
GRANT ALL ON public.school_research TO service_role;
GRANT SELECT ON public.training_docs TO authenticated, anon;
GRANT ALL ON public.training_docs TO service_role;
GRANT SELECT ON public.training_jobs TO authenticated, anon;
GRANT ALL ON public.training_jobs TO service_role;

-- RLS
ALTER TABLE public.admissions_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_jobs ENABLE ROW LEVEL SECURITY;
`;

    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${managementToken}`,
      },
      body: JSON.stringify({ query: SQL }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(응답 없음)");
      throw new Error(`Management API 오류 (${res.status}): ${body.slice(0, 300)}`);
    }

    return { ok: true, message: "마이그레이션 완료! 페이지를 새로고침하세요." };
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
