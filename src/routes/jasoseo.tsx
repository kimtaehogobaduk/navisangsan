import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { reviewJasoseo } from "@/lib/ai.functions";
import { PenLine, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/jasoseo")({
  head: () => ({ meta: [{ title: "자소서 AI 첨삭 — NAVI" }] }),
  component: JasoseoPage,
});

const QUESTIONS = [
  "1번 문항: 고등학교 재학 기간 중 자신의 진로와 관련하여 어떤 노력을 해왔는지 본인에게 의미 있는 학습 경험과 교내 활동을 중심으로 기술해 주시기 바랍니다.",
  "2번 문항: 고등학교 재학 기간 중 타인과 공동체를 위해 노력한 경험과 이를 통해 배운 점을 기술해 주시기 바랍니다.",
  "3번 문항: 지원 동기 및 고등학교 재학 중 배운 점을 바탕으로 대학 입학 후 학업계획과 향후 진로 계획을 기술해 주시기 바랍니다.",
  "직접 입력",
];

function JasoseoPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [selectedQ, setSelectedQ] = useState(QUESTIONS[0]);
  const [customQ, setCustomQ] = useState("");
  const [essay, setEssay] = useState("");
  const [targetUniversity, setTargetUniversity] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const review = useServerFn(reviewJasoseo);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      (markProfileRequired("자소서 첨삭"), navigate({ to: "/onboarding" }));
      return;
    }
    setProfile(p);
    setTargetUniversity(p.targetUniversity || "");
  }, [navigate]);

  const finalQuestion = selectedQ === "직접 입력" ? customQ : selectedQ;
  const charCount = essay.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalQuestion.trim() || !essay.trim() || !profile) return;
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const res = await review({
        data: { profile, question: finalQuestion, essay, targetUniversity },
      });
      setResult(res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "첨삭 실패");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-brand";

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <PenLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">자소서 AI 첨삭</h1>
          <p className="text-xs text-muted-foreground">
            대치동 컨설턴트 수준의 자기소개서 피드백
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted-foreground">자소서 문항 선택</span>
          <div className="space-y-2">
            {QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setSelectedQ(q)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-xs transition ${
                  selectedQ === q
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-surface-elevated"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          {selectedQ === "직접 입력" && (
            <textarea
              value={customQ}
              onChange={(e) => setCustomQ(e.target.value)}
              placeholder="자소서 문항을 직접 입력하세요"
              className={`${inputCls} mt-2 min-h-[80px]`}
              required={selectedQ === "직접 입력"}
            />
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">자소서 내용</span>
            <span
              className={`text-xs ${charCount > 1500 ? "text-destructive" : charCount > 1000 ? "text-warning" : "text-muted-foreground"}`}
            >
              {charCount.toLocaleString()}자
            </span>
          </div>
          <textarea
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            placeholder="작성한 자소서 내용을 붙여넣으세요. (초안도 괜찮습니다)"
            className={`${inputCls} min-h-[200px]`}
            required
          />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            지원 대학 (선택)
          </span>
          <input
            value={targetUniversity}
            onChange={(e) => setTargetUniversity(e.target.value)}
            placeholder="예: 부산대학교 정보컴퓨터공학부"
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !essay.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> AI 첨삭 중…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> AI 첨삭 받기
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {result && (
        <article className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">첨삭 결과</h2>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium transition hover:border-brand/40"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <Markdown>{result}</Markdown>
        </article>
      )}
    </AppShell>
  );
}
