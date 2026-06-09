import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { generateParentReport } from "@/lib/ai.functions";
import { Users, Loader2, Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/parent")({
  head: () => ({ meta: [{ title: "학부모 뷰 — NAVI" }] }),
  component: ParentPage,
});

function ParentPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genReport = useServerFn(generateParentReport);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);

    const roadmapRaw = localStorage.getItem("navi.roadmap.v1");
    const doneRaw = localStorage.getItem("navi.roadmap.done.v1");

    if (roadmapRaw && doneRaw) {
      const months = JSON.parse(roadmapRaw) as Array<{ title: string; tasks: string[] }>;
      const doneSet = new Set<string>(JSON.parse(doneRaw) as string[]);
      const allTasks: string[] = [];
      const done: string[] = [];
      const pending: string[] = [];
      months.forEach((m, mi) => {
        m.tasks.forEach((t, ti) => {
          allTasks.push(t);
          if (doneSet.has(`t-${mi}-${ti}`)) done.push(t);
          else pending.push(t);
        });
      });
      setCompletedTasks(done);
      setPendingTasks(pending);
      setProgress(allTasks.length ? Math.round((done.length / allTasks.length) * 100) : 0);
    }

    const cached = localStorage.getItem("navi.parent.report.v1");
    if (cached) setReport(cached);
  }, []);

  async function fetchReport() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await genReport({
        data: { profile, progress, completedTasks, pendingTasks },
      });
      setReport(res.reply);
      localStorage.setItem("navi.parent.report.v1", res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "리포트 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">학부모 뷰</h1>
        <p className="text-sm text-muted-foreground">
          자녀가 먼저 NAVI에서 프로필을 설정해야 합니다.
          <br />
          같은 기기에서 자녀가 로그인한 후 이 페이지를 열어주세요.
        </p>
        <Link
          to="/onboarding"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow"
        >
          자녀 프로필 설정하기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">NAVI 학부모 뷰</span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            학생 대시보드 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        {/* 자녀 현황 카드 */}
        <section className="overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">자녀 현황</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">{profile.name}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {profile.grade} · {profile.trackType} · {profile.region || "지역 미입력"}
              </p>
              <p className="mt-1 text-sm">
                목표:{" "}
                <span className="font-medium text-brand">
                  {profile.targetUniversity || "미정"} {profile.targetMajor}
                </span>
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow text-2xl">
              📚
            </div>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>로드맵 진행률</span>
              <span className="font-medium text-foreground">{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {/* 과제 현황 */}
        {(completedTasks.length > 0 || pendingTasks.length > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold">
                ✅ 완료한 과제{" "}
                <span className="ml-1 rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
                  {completedTasks.length}
                </span>
              </h3>
              {completedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">아직 없습니다</p>
              ) : (
                <ul className="space-y-1.5">
                  {completedTasks.slice(0, 5).map((t, i) => (
                    <li key={i} className="text-xs text-muted-foreground line-through">
                      {t}
                    </li>
                  ))}
                  {completedTasks.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      외 {completedTasks.length - 5}개
                    </li>
                  )}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="mb-3 text-sm font-semibold">
                ⏳ 남은 과제{" "}
                <span className="ml-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning">
                  {pendingTasks.length}
                </span>
              </h3>
              {pendingTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">모두 완료했습니다 🎉</p>
              ) : (
                <ul className="space-y-1.5">
                  {pendingTasks.slice(0, 5).map((t, i) => (
                    <li key={i} className="text-xs text-foreground">
                      • {t}
                    </li>
                  ))}
                  {pendingTasks.length > 5 && (
                    <li className="text-xs text-muted-foreground">
                      외 {pendingTasks.length - 5}개
                    </li>
                  )}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* 주간 리포트 */}
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">AI 주간 리포트</h3>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-elevated disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : report ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {report ? "리포트 갱신" : "리포트 생성"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              <p className="mt-2">AI가 리포트를 작성 중…</p>
            </div>
          )}

          {!report && !loading && (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                자녀의 이번 주 진행 상황과 다음 주 우선 과제를
                <br />
                AI가 학부모 눈높이로 정리해드립니다.
              </p>
              <button
                onClick={fetchReport}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
              >
                <Sparkles className="h-4 w-4" /> 리포트 받기
              </button>
            </div>
          )}

          {report && !loading && (
            <article className="mt-4 rounded-2xl border border-border bg-surface p-5">
              <Markdown>{report}</Markdown>
            </article>
          )}
        </section>

        {/* 빠른 이동 */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-sm font-semibold">자녀 기능 바로가기</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { to: "/dashboard", label: "📊 로드맵" },
              { to: "/jeonhyeong", label: "🎯 전형분석" },
              { to: "/saengbu", label: "📝 생기부" },
              { to: "/coach", label: "💬 AI코치" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-xs font-medium transition hover:border-brand/40 hover:bg-surface-elevated"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
