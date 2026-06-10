import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { generateCurriculum } from "@/lib/ai.functions";
import { Map, Loader2, Sparkles, Tv, BookMarked, Trophy } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/curriculum")({
  head: () => ({ meta: [{ title: "커리큘럼 허브 — NAVI" }] }),
  component: CurriculumPage,
});

type Tab = "lecture" | "book" | "contest";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "lecture", label: "EBS 강의", icon: Tv, desc: "추천 강의 목록" },
  { id: "book", label: "추천 도서", icon: BookMarked, desc: "학과 연계 독서" },
  { id: "contest", label: "공모전 전략", icon: Trophy, desc: "생기부 연결 가이드" },
];

function CurriculumPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("lecture");
  const [results, setResults] = useState<Partial<Record<Tab, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gen = useServerFn(generateCurriculum);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      (markProfileRequired("커리큘럼 허브"), navigate({ to: "/onboarding" }));
      return;
    }
    setProfile(p);
    const cached = localStorage.getItem("navi.curriculum.v1");
    if (cached) setResults(JSON.parse(cached));
  }, [navigate]);

  async function fetchTab(tab: Tab) {
    if (!profile) return;
    if (results[tab]) {
      setActiveTab(tab);
      return;
    }
    setActiveTab(tab);
    setLoading(true);
    setError(null);
    try {
      const res = await gen({ data: { profile, tab } });
      const next = { ...results, [tab]: res.reply };
      setResults(next);
      localStorage.setItem("navi.curriculum.v1", JSON.stringify(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await gen({ data: { profile, tab: activeTab } });
      const next = { ...results, [activeTab]: res.reply };
      setResults(next);
      localStorage.setItem("navi.curriculum.v1", JSON.stringify(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Map className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">커리큘럼 허브</h1>
          <p className="text-xs text-muted-foreground">EBS 강의 · 추천 도서 · 공모전 전략 통합</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => fetchTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand/10 text-brand shadow-[0_0_12px_var(--brand-glow)/20]"
                  : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-2">AI가 맞춤 콘텐츠를 큐레이션하는 중…</p>
        </div>
      )}

      {!loading && !results[activeTab] && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          {(() => {
            const tab = TABS.find((t) => t.id === activeTab)!;
            const Icon = tab.icon;
            return (
              <>
                <Icon className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {profile?.name}님 프로필 기반으로 맞춤 {tab.label}를 생성합니다.
                </p>
                <button
                  onClick={() => fetchTab(activeTab)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
                >
                  <Sparkles className="h-4 w-4" /> {tab.label} 추천받기
                </button>
              </>
            );
          })()}
        </div>
      )}

      {!loading && results[activeTab] && (
        <article className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {TABS.find((t) => t.id === activeTab)?.label} 맞춤 추천
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" /> 다시 추천
            </button>
          </div>
          <Markdown>{results[activeTab]!}</Markdown>
        </article>
      )}
    </AppShell>
  );
}
