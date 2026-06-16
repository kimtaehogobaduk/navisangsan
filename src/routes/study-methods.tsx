import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { generateStudyMethods } from "@/lib/ai.functions";
import { Brain, Loader2, Sparkles, Copy, Check, RefreshCw } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/study-methods")({
  head: () => ({ meta: [{ title: "공부방법 제안 — NAVI" }] }),
  component: StudyMethodsPage,
});

const METHOD_TAGS = [
  "포모도로", "코넬 노트", "스페이스드 리피티션", "파인만 기법",
  "인터리빙", "액티브 리콜", "듀얼 코딩", "역방향 학습",
];

function StudyMethodsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const generate = useServerFn(generateStudyMethods);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      markProfileRequired("공부방법 제안");
      navigate({ to: "/onboarding" });
      return;
    }
    setProfile(p);
  }, [navigate]);

  async function handleGenerate() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const res = await generate({ data: { profile } });
      setResult(res?.reply ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공부방법 제안</h1>
          <p className="text-xs text-muted-foreground">
            나의 성적·목표에 완전히 최적화된 공부법 AI 분석
          </p>
        </div>
      </div>

      {/* Intro card */}
      {!result && !loading && (
        <div className="mb-5 rounded-2xl border border-border bg-surface p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              이런 내용을 분석해드려요 ✨
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">🧠</span>
                <span>내 학습 유형 분석 + 목표 대학까지의 갭 진단</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">✅</span>
                <span>과학적으로 검증된 고전 공부법 5가지 (나에게 맞게 커스터마이징)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">🚀</span>
                <span>신경과학 기반 독창적·혁신적 공부법 5가지 이상</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">📖</span>
                <span>취약 과목별 맞춤 전략 + 일일/주간 루틴 설계</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">🎯</span>
                <span>이번 주 바로 시작할 3가지 (즉시 실행 가능)</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {METHOD_TAGS.map((tag) => (
              <span key={tag} className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                {tag}
              </span>
            ))}
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">+ 더 많은 기법들</span>
          </div>

          {profile && (
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{profile.name || "내"} 프로필 기반</span>
              {" — "}
              {[profile.grade, profile.track, profile.targetUniversity && `목표: ${profile.targetUniversity}`]
                .filter(Boolean).join(" · ")}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !profile}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3.5 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            AI 공부법 분석 시작
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <Brain className="h-7 w-7 text-white animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI가 공부법을 분석하고 있어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              프로필을 깊이 분석해서 최적화된 공부법을 찾는 중...
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            <span className="text-xs text-muted-foreground">약 15~30초 소요</span>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {METHOD_TAGS.map((tag, i) => (
              <span key={tag} className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[10px] text-brand/70"
                style={{ animationDelay: `${i * 0.15}s` }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <button onClick={handleGenerate} className="mt-2 flex items-center gap-1.5 text-xs font-medium hover:underline">
            <RefreshCw className="h-3 w-3" /> 다시 시도
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <>
          <article className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">AI 공부법 분석 결과</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium transition hover:border-brand/40 disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  재생성
                </button>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium transition hover:border-brand/40"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            </div>
            <Markdown storageKey="study-methods">{result}</Markdown>
          </article>

          <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs text-muted-foreground">
            💡 공부법은 실제로 해봐야 나에게 맞는지 알 수 있어요. 2주간 시도해보고 AI 코치에게 피드백을 받아보세요!
          </div>
        </>
      )}
    </AppShell>
  );
}
