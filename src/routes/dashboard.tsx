import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RoadmapView } from "@/components/RoadmapView";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { loadRoadmap, saveRoadmap, loadDone, saveDone, type RoadmapData } from "@/lib/roadmap";
import { getTrainingContext } from "@/lib/training";
import { generateRoadmap } from "@/lib/ai.functions";
import {
  FileText, MessageCircle, Sparkles, Target, RefreshCw, Loader2,
  CheckCircle2, BarChart3, AlertCircle, Settings,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "내 로드맵 — NAVI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const genRoadmap = useServerFn(generateRoadmap);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { (markProfileRequired("로드맵"), navigate({ to: "/onboarding" })); return; }
    setProfile(p);
    const cached = loadRoadmap();
    if (cached) setRoadmap(cached);
    setDone(loadDone());
  }, [navigate]);

  useEffect(() => {
    if (!roadmap) return;
    saveRoadmap(roadmap);
    const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    setSavedAt(now);
  }, [roadmap]);

  useEffect(() => { saveDone(done); }, [done]);

  async function fetchRoadmap() {
    if (!profile) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    try {
      const trainingContext = getTrainingContext();
      const t1 = setTimeout(() => setLoadingStep(1), 3000);
      const t2 = setTimeout(() => setLoadingStep(2), 6000);
      const res = await genRoadmap({ data: { profile, trainingContext } });
      clearTimeout(t1); clearTimeout(t2);
      if (res?.roadmap?.months?.length) {
        setRoadmap(res.roadmap);
        setDone(new Set());
      } else {
        setError("로드맵 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드맵 생성 실패");
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  }

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!profile) return null;

  const allItems = roadmap?.months.flatMap((m) => m.checkItems ?? []) ?? [];
  const doneCount = allItems.filter((c) => done.has(c.id)).length;
  const progress = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;

  return (
    <AppShell>
      {/* ── Hero ── */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">안녕하세요 👋</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {profile.name}님의 입시 로드맵
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.grade} · {profile.trackType}
              {profile.targetUniversity && ` · 목표 ${profile.targetUniversity}`}
              {profile.targetMajor && ` ${profile.targetMajor}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
              <Sparkles className="h-6 w-6" />
            </div>
            <Link
              to="/onboarding"
              className="flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
            >
              <Settings className="h-3 w-3" /> 프로필 수정
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-brand">{progress}%</div>
            <div className="text-[10px] text-muted-foreground">전체 진행률</div>
          </div>
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-emerald-400">{doneCount}</div>
            <div className="text-[10px] text-muted-foreground">완료 항목</div>
          </div>
          <div className="rounded-xl bg-background/60 p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{allItems.length - doneCount}</div>
            <div className="text-[10px] text-muted-foreground">남은 항목</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-brand transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {savedAt && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <CheckCircle2 className="h-3 w-3" /> 자동저장 완료 {savedAt}
          </div>
        )}
      </section>

      {/* ── Quick actions ── */}
      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <QuickCard to="/coach" icon={MessageCircle} title="AI 코치" desc="24시간 진로 상담" />
        <QuickCard to="/saengbu" icon={FileText} title="생기부 빌더" desc="세특 문구 자동 생성" />
        <QuickCard to="/jeonhyeong" icon={Target} title="전형 분석" desc="수시 6장 최적 조합" />
      </section>

      {/* ── Roadmap section ── */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">3개월 맞춤 입시 로드맵</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              월별 학습 전략 · 수능 대비 · 생기부 전략 · 수시/정시 계획 통합
            </p>
          </div>
          <button
            onClick={fetchRoadmap}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium transition hover:bg-surface-elevated disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {roadmap ? "다시 생성" : "AI로 생성"}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Empty state */}
        {!roadmap && !loading && (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium text-foreground">AI 맞춤 로드맵 생성</p>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto">
              월별 학습 전략, 수능 포인트, 생기부 전략, 수시/정시 지원 계획을 한눈에 확인하세요.
            </p>
            <button
              onClick={fetchRoadmap}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
            >
              <Sparkles className="h-4 w-4" /> 로드맵 생성하기
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
            <p className="mt-3 text-sm font-medium">AI가 맞춤 로드맵을 분석 중입니다…</p>
            <p className="mt-1 text-xs text-muted-foreground/60">학습 전략 · 수능 · 생기부 · 지원 전략 종합 분석 중</p>
            <div className="mt-6 space-y-2 text-left max-w-sm mx-auto">
              {[
                "프로필 분석 및 취약 과목 파악",
                "3개월 월별 학습·수능 전략 수립",
                "생기부·수시·정시 전략 완성",
              ].map((label, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-xs transition-all ${
                    loadingStep > i
                      ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                      : loadingStep === i
                      ? "border-brand/40 bg-brand/5 text-foreground"
                      : "border-border bg-background/50 text-muted-foreground"
                  }`}
                >
                  {loadingStep > i ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : loadingStep === i ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border border-border" />
                  )}
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roadmap content */}
        {roadmap && !loading && (
          <RoadmapView data={roadmap} done={done} onToggle={toggleDone} />
        )}
      </section>
    </AppShell>
  );
}

function QuickCard({ to, icon: Icon, title, desc }: {
  to: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
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
