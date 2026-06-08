import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { generateRoadmap } from "@/lib/ai.functions";
import { FileText, MessageCircle, Sparkles, Target, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "내 로드맵 — NAVI" }] }),
  component: Dashboard,
});

type Month = { title: string; focus: string; tasks: string[] };

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRoadmap = useServerFn(generateRoadmap);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      navigate({ to: "/onboarding" });
      return;
    }
    setProfile(p);

    const cached = localStorage.getItem("navi.roadmap.v1");
    const cachedDone = localStorage.getItem("navi.roadmap.done.v1");
    if (cached) setMonths(JSON.parse(cached));
    if (cachedDone) setDone(new Set(JSON.parse(cachedDone)));
  }, [navigate]);

  async function fetchRoadmap() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await genRoadmap({ data: { profile } });
      setMonths(res.months);
      localStorage.setItem("navi.roadmap.v1", JSON.stringify(res.months));
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드맵 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("navi.roadmap.done.v1", JSON.stringify([...next]));
      return next;
    });
  }

  if (!profile) return null;

  const totalTasks = months.reduce((a, m) => a + m.tasks.length, 0);
  const doneCount = [...done].filter((id) => id.startsWith("t-")).length;
  const progress = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <AppShell>
      {/* Hero card */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">안녕하세요 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {profile.name}님의 입시 로드맵
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.grade} · {profile.trackType} · 목표 {profile.targetUniversity || "미정"}{" "}
              {profile.targetMajor}
            </p>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>이번 분기 진행률</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <QuickCard
          to="/coach"
          icon={MessageCircle}
          title="AI 코치"
          desc="24시간 진로 상담"
        />
        <QuickCard
          to="/saengbu"
          icon={FileText}
          title="생기부 빌더"
          desc="세특 문구 자동 생성"
        />
        <QuickCard
          to="/jeonhyeong"
          icon={Target}
          title="전형 분석"
          desc="수시 6장 최적 조합"
        />
      </section>

      {/* Roadmap */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">월별 실행 플랜</h2>
          <button
            onClick={fetchRoadmap}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-elevated disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {months.length ? "다시 생성" : "AI로 생성"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        {!months.length && !loading && (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              AI 코치가 학생 프로필 기반으로 향후 3개월 로드맵을 만들어드립니다.
            </p>
            <button
              onClick={fetchRoadmap}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
            >
              <Sparkles className="h-4 w-4" /> 로드맵 생성하기
            </button>
          </div>
        )}

        {loading && !months.length && (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-2">Cerebras로 로드맵 생성 중…</p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {months.map((m, mi) => (
            <article
              key={mi}
              className="rounded-2xl border border-border bg-surface p-5 transition hover:border-brand/30"
            >
              <h3 className="text-base font-semibold">{m.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{m.focus}</p>
              <ul className="mt-4 space-y-2">
                {m.tasks.map((t, ti) => {
                  const id = `t-${mi}-${ti}`;
                  const checked = done.has(id);
                  return (
                    <li key={id}>
                      <button
                        onClick={() => toggleTask(id)}
                        className="flex w-full items-start gap-3 rounded-xl border border-transparent px-2 py-2 text-left text-sm transition hover:border-border hover:bg-surface-elevated"
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                            checked
                              ? "border-brand bg-brand text-brand-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {checked && (
                            <svg viewBox="0 0 12 12" className="h-3 w-3">
                              <path
                                d="M2 6l3 3 5-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        <span className={checked ? "text-muted-foreground line-through" : ""}>
                          {t}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function QuickCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-brand/40 hover:bg-surface-elevated"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  );
}
