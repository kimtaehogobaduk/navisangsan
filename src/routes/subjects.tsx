import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { recommendSubjects } from "@/lib/ai.functions";
import { BookOpen, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/subjects")({
  head: () => ({ meta: [{ title: "선택과목 추천 — NAVI" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [currentSubjects, setCurrentSubjects] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recommend = useServerFn(recommendSubjects);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      (markProfileRequired("선택과목 추천"), navigate({ to: "/onboarding" }));
      return;
    }
    setProfile(p);
    const cached = localStorage.getItem("navi.subjects.v1");
    if (cached) setResult(cached);
  }, [navigate]);

  async function run() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const res = await recommend({ data: { profile, currentSubjects } });
      setResult(res.reply);
      localStorage.setItem("navi.subjects.v1", res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "추천 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">선택과목 추천</h1>
          <p className="text-xs text-muted-foreground">
            고교학점제 선택과목 AI 전략 — 목표 학과 맞춤 조합
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">📌 고교학점제란?</span> 학생이 원하는 과목을 직접
          선택해 이수하고 학점을 취득하는 제도. 목표 학과에 맞는 과목 선택이 입시에 직결됩니다.
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            현재 수강 중인 과목 (선택)
          </span>
          <textarea
            value={currentSubjects}
            onChange={(e) => setCurrentSubjects(e.target.value)}
            placeholder="예: 수학Ⅰ, 수학Ⅱ, 영어, 통합과학, 한국사 (현재 이수 중인 과목을 입력하면 더 정확한 추천이 가능합니다)"
            className="min-h-[80px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-brand"
          />
        </label>

        <button
          onClick={run}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> AI 분석 중…
            </>
          ) : result ? (
            <>
              <RefreshCw className="h-4 w-4" /> 다시 추천받기
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> 선택과목 추천받기
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {!result && !loading && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {profile?.grade}({profile?.trackType}) · {profile?.targetMajor || "목표 학과 미설정"} 기반
            <br />
            AI가 최적의 선택과목 조합을 추천해드립니다.
          </p>
        </div>
      )}

      {result && (
        <article className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <Markdown>{result}</Markdown>
        </article>
      )}
    </AppShell>
  );
}
