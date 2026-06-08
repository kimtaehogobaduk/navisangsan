import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { buildSaengbu } from "@/lib/ai.functions";
import { FileText, Loader2, Sparkles, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/saengbu")({
  head: () => ({ meta: [{ title: "생기부 AI 빌더 — NAVI" }] }),
  component: SaengbuPage,
});

function SaengbuPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [subject, setSubject] = useState("");
  const [activity, setActivity] = useState("");
  const [targetMajor, setTargetMajor] = useState("");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const build = useServerFn(buildSaengbu);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      navigate({ to: "/onboarding" });
      return;
    }
    setProfile(p);
    setTargetMajor(p.targetMajor || "");
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !activity.trim() || !profile) return;
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const res = await build({
        data: { profile, subject, activity, targetMajor },
      });
      setResult(res.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
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
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">생기부 AI 빌더</h1>
          <p className="text-xs text-muted-foreground">활동 입력 → 목표 학과 키워드 반영 세특 자동 생성</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <Field label="과목 / 단원">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="예: 통합과학 - 화학변화"
            className={inputCls}
            required
          />
        </Field>
        <Field label="목표 학과">
          <input
            value={targetMajor}
            onChange={(e) => setTargetMajor(e.target.value)}
            placeholder="예: 화학공학과"
            className={inputCls}
          />
        </Field>
        <Field label="실제 수행한 활동 내용">
          <textarea
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="예: 산-염기 중화반응 실험을 직접 설계하고, 가정용 식초와 베이킹소다의 농도를 달리하며 pH 변화를 측정. 결과를 토대로 환경친화적 세정제 조합을 제안하는 보고서 작성."
            className={`${inputCls} min-h-[140px]`}
            required
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Cerebras로 생성 중…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> 세특 문구 생성
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
            <h2 className="text-sm font-semibold text-muted-foreground">생성 결과</h2>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium transition hover:border-brand/40"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
        </article>
      )}
    </AppShell>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
