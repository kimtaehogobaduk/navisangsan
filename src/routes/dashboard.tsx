import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MindMap } from "@/components/MindMap";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { loadRoadmap, saveRoadmap, loadDone, saveDone, CATEGORY_META, type RoadmapMonth, type RoadmapTask } from "@/lib/roadmap";
import { getTrainingContext } from "@/lib/training";
import { generateRoadmap } from "@/lib/ai.functions";
import {
  FileText, MessageCircle, Sparkles, Target, RefreshCw, Loader2,
  ChevronDown, ChevronUp, Clock, AlertCircle, CheckCircle2,
  BarChart3, Network, List, Trophy, Flame,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "내 로드맵 — NAVI" }] }),
  component: Dashboard,
});

type View = "plan" | "mindmap";

const PRIORITY_LABEL: Record<RoadmapTask["priority"], { label: string; color: string }> = {
  high: { label: "긴급", color: "text-red-400" },
  medium: { label: "중요", color: "text-amber-400" },
  low: { label: "일반", color: "text-muted-foreground" },
};

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [months, setMonths] = useState<RoadmapMonth[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("plan");
  const [activeMonth, setActiveMonth] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const genRoadmap = useServerFn(generateRoadmap);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { navigate({ to: "/onboarding" }); return; }
    setProfile(p);
    const cached = loadRoadmap();
    const cachedDone = loadDone();
    if (cached.length) setMonths(cached);
    setDone(cachedDone);
  }, [navigate]);

  // Auto-save months whenever they change
  useEffect(() => {
    if (!months.length) return;
    saveRoadmap(months);
    const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    setSavedAt(now);
  }, [months]);

  // Auto-save done whenever it changes
  useEffect(() => {
    saveDone(done);
  }, [done]);

  async function fetchRoadmap() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const trainingContext = getTrainingContext();
      const res = await genRoadmap({ data: { profile, trainingContext } });
      if (res?.months?.length) {
        setMonths(res.months);
        setActiveMonth(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드맵 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!profile) return null;

  const allTasks = months.flatMap((m) => m.weeks.flatMap((w) => w.tasks));
  const totalTasks = allTasks.length;
  const doneCount = allTasks.filter((t) => done.has(t.id)).length;
  const progress = totalTasks ? Math.round((doneCount / totalTasks) * 100) : 0;

  const currentMonth = months[activeMonth];

  const monthTasks = currentMonth ? currentMonth.weeks.flatMap((w) => w.tasks) : [];
  const monthDone = monthTasks.filter((t) => done.has(t.id)).length;
  const monthProgress = monthTasks.length ? Math.round((monthDone / monthTasks.length) * 100) : 0;

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

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-brand">{progress}%</div>
            <div className="text-[10px] text-muted-foreground">전체 진행률</div>
          </div>
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-emerald-400">{doneCount}</div>
            <div className="text-[10px] text-muted-foreground">완료 과제</div>
          </div>
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{totalTasks - doneCount}</div>
            <div className="text-[10px] text-muted-foreground">남은 과제</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {savedAt && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <CheckCircle2 className="h-3 w-3" />
            자동저장 완료 {savedAt}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <QuickCard to="/coach" icon={MessageCircle} title="AI 코치" desc="24시간 진로 상담" />
        <QuickCard to="/saengbu" icon={FileText} title="생기부 빌더" desc="세특 문구 자동 생성" />
        <QuickCard to="/jeonhyeong" icon={Target} title="전형 분석" desc="수시 6장 최적 조합" />
      </section>

      {/* Roadmap section */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">3개월 실행 로드맵</h2>
          <div className="flex items-center gap-2">
            {months.length > 0 && (
              <div className="flex rounded-xl border border-border bg-surface p-0.5">
                {(["plan", "mindmap"] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      view === v ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v === "plan" ? <List className="h-3.5 w-3.5" /> : <Network className="h-3.5 w-3.5" />}
                    {v === "plan" ? "플랜뷰" : "마인드맵"}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={fetchRoadmap}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-elevated disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {months.length ? "다시 생성" : "AI로 생성"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!months.length && !loading && (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              AI 코치가 학생 프로필 기반으로<br />초상세 3개월 로드맵 + 마인드맵을 만들어드립니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              주차별 세부 과제 · 예상 소요 시간 · 학습 팁 포함
            </p>
            <button
              onClick={fetchRoadmap}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
            >
              <Sparkles className="h-4 w-4" /> 로드맵 생성하기
            </button>
          </div>
        )}

        {loading && !months.length && (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <p className="mt-3 text-sm font-medium">Cerebras AI가 3개월 로드맵 생성 중…</p>
            <p className="mt-1 text-xs text-muted-foreground/60">3개월을 동시에 병렬 생성하고 있어요</p>
            <div className="mt-5 flex justify-center gap-3">
              {["1개월차", "2개월차", "3개월차"].map((label, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  <Loader2 className="h-3 w-3 animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {months.length > 0 && (
          <>
            {/* Month tabs */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {months.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setActiveMonth(i)}
                  className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    activeMonth === i
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {i + 1}개월차
                  {activeMonth === i && (
                    <span className="ml-2 text-[10px] opacity-70">{monthProgress}%</span>
                  )}
                </button>
              ))}
            </div>

            {currentMonth && (
              <>
                {/* Month overview */}
                <div
                  className="mt-4 rounded-2xl border p-4"
                  style={{ borderColor: `${currentMonth.theme}44`, background: `${currentMonth.theme}0a` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold" style={{ color: currentMonth.theme }}>
                        {currentMonth.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{currentMonth.focus}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-bold" style={{ color: currentMonth.theme }}>
                        {monthProgress}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">이번 달</div>
                    </div>
                  </div>
                  {currentMonth.milestones?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {currentMonth.milestones.map((m, i) => (
                        <span
                          key={i}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: `${currentMonth.theme}20`, color: currentMonth.theme }}
                        >
                          <Trophy className="h-3 w-3" /> {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* View: Plan or MindMap */}
                {view === "mindmap" ? (
                  <div className="mt-4">
                    <MindMap month={currentMonth} />
                  </div>
                ) : (
                  <div className="mt-4 space-y-6">
                    {currentMonth.weeks.map((week) => (
                      <div key={week.weekNum}>
                        <div className="mb-3 flex items-center gap-2">
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: currentMonth.theme }}
                          >
                            {week.weekNum}
                          </div>
                          <span className="text-sm font-semibold">{week.weekNum}주차</span>
                          <span className="text-xs text-muted-foreground">— {week.focus}</span>
                        </div>

                        <div className="space-y-3">
                          {week.tasks.map((task) => {
                            const checked = done.has(task.id);
                            const expanded = expandedTasks.has(task.id);
                            const meta = CATEGORY_META[task.category];
                            const priMeta = PRIORITY_LABEL[task.priority];

                            return (
                              <div
                                key={task.id}
                                className={`rounded-2xl border transition ${
                                  checked
                                    ? "border-border/50 bg-surface/50 opacity-70"
                                    : "border-border bg-surface hover:border-brand/30"
                                }`}
                              >
                                <div className="p-4">
                                  <div className="flex items-start gap-3">
                                    <button
                                      onClick={() => toggleTask(task.id)}
                                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                                        checked
                                          ? "border-brand bg-brand text-brand-foreground"
                                          : "border-border bg-background hover:border-brand"
                                      }`}
                                    >
                                      {checked && (
                                        <svg viewBox="0 0 12 12" className="h-3 w-3">
                                          <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                          style={{ background: meta.bg, color: meta.color }}
                                        >
                                          {meta.label}
                                        </span>
                                        <span className={`text-[10px] font-medium ${priMeta.color}`}>
                                          {task.priority === "high" && <Flame className="mr-0.5 inline h-3 w-3" />}
                                          {priMeta.label}
                                        </span>
                                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          {task.estimatedHours}h
                                        </span>
                                      </div>
                                      <p className={`mt-1.5 text-sm font-semibold ${checked ? "line-through text-muted-foreground" : ""}`}>
                                        {task.title}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">{task.detail}</p>
                                    </div>

                                    {task.subtasks?.length > 0 && (
                                      <button
                                        onClick={() => toggleExpand(task.id)}
                                        className="shrink-0 rounded-lg border border-border p-1 text-muted-foreground transition hover:text-foreground"
                                      >
                                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {expanded && task.subtasks?.length > 0 && (
                                  <div className="border-t border-border/50 px-4 pb-4 pt-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                      세부 실행 단계
                                    </p>
                                    <ul className="space-y-2">
                                      {task.subtasks.map((sub, si) => (
                                        <li key={si} className="flex items-start gap-2.5">
                                          <span
                                            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                            style={{ background: meta.color }}
                                          >
                                            {si + 1}
                                          </span>
                                          <div>
                                            <span className="text-xs font-semibold">{sub.text}</span>
                                            {sub.detail && (
                                              <p className="mt-0.5 text-[11px] text-muted-foreground">{sub.detail}</p>
                                            )}
                                            {sub.resource && (
                                              <p className="mt-0.5 text-[11px]" style={{ color: meta.color }}>
                                                📎 {sub.resource}
                                              </p>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
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
