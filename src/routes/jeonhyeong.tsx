import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { analyzeJeonhyeong } from "@/lib/ai.functions";
import { Target, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/jeonhyeong")({
  head: () => ({ meta: [{ title: "전형 분석 — NAVI" }] }),
  component: JeonhyeongPage,
});

function JeonhyeongPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyze = useServerFn(analyzeJeonhyeong);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      navigate({ to: "/onboarding" });
      return;
    }
    setProfile(p);
    const cached = localStorage.getItem("navi.jeonhyeong.v1");
    if (cached) setResult(cached);
  }, [navigate]);

  async function run() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const res = await analyze({ data: { profile, question } });
      setResult(res.reply);
      localStorage.setItem("navi.jeonhyeong.v1", res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전형 분석</h1>
          <p className="text-xs text-muted-foreground">
            수시 학종/교과/논술 · 정시 비중 · 지원 가능 대학 시뮬레이션
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            추가로 묻고 싶은 점 (선택)
          </span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="예: 부산대 정보컴퓨터공학부 학종 가능성과 비교 대학을 알려줘"
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
              <Loader2 className="h-4 w-4 animate-spin" /> Cerebras로 분석 중…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> 전형 분석 실행
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <article className="mt-6 whitespace-pre-wrap rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed">
          {result}
        </article>
      )}
    </AppShell>
  );
}
