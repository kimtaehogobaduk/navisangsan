import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { interviewChat } from "@/lib/ai.functions";
import { Mic, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/interview")({
  head: () => ({ meta: [{ title: "면접 시뮬레이터 — NAVI" }] }),
  component: InterviewPage,
});

type Msg = { role: "user" | "assistant"; content: string };
type InterviewType = "general" | "subject" | "situational";

const TYPES: { id: InterviewType; label: string; desc: string; emoji: string }[] = [
  { id: "general", label: "인성·일반", desc: "지원 동기, 학교생활 등", emoji: "🤝" },
  { id: "subject", label: "전공 적성", desc: "관심 분야 심층 질문", emoji: "🔬" },
  { id: "situational", label: "상황 제시형", desc: "시나리오 기반 판단력", emoji: "💡" },
];

function InterviewPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [interviewType, setInterviewType] = useState<InterviewType>("general");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(interviewChat);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      navigate({ to: "/onboarding" });
      return;
    }
    setProfile(p);
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function startInterview() {
    if (!profile) return;
    setStarted(true);
    setMessages([]);
    setLoading(true);
    const initMsg: Msg = { role: "user", content: "면접을 시작해주세요." };
    try {
      const { reply } = await chat({
        data: { messages: [initMsg], profile, interviewType },
      });
      setMessages([{ role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([
        {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "면접 시작 실패. 다시 시도해주세요."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || loading || !profile) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { reply } = await chat({
        data: { messages: next, profile, interviewType },
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([
        ...next,
        { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "응답 실패"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStarted(false);
    setMessages([]);
    setInput("");
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">면접 시뮬레이터</h1>
            <p className="text-xs text-muted-foreground">AI 면접관과 실전 대비 연습</p>
          </div>
        </div>
        {started && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 처음부터
          </button>
        )}
      </div>

      {!started ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-4 text-sm font-medium">면접 유형 선택</p>
            <div className="grid gap-3 md:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInterviewType(t.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    interviewType === t.id
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background hover:bg-surface-elevated"
                  }`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <p className="mt-2 text-sm font-semibold">{t.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-surface/50 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">💡 면접 진행 방식</p>
            <ul className="mt-2 space-y-1">
              <li>• AI 면접관이 질문 → 학생이 답변 → 즉시 피드백</li>
              <li>• 5~7개 질문 후 종합 점수 및 피드백 제공</li>
              <li>• 학생 프로필·목표 학과 기반 맞춤 질문</li>
            </ul>
          </div>

          <button
            onClick={startInterview}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-6 py-4 text-base font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01]"
          >
            <Sparkles className="h-5 w-5" />{" "}
            {TYPES.find((t) => t.id === interviewType)?.label} 면접 시작
          </button>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex h-[55vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-surface/50 p-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mr-2 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-brand text-brand-foreground shadow-glow">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-gradient-brand text-brand-foreground shadow-glow"
                      : "border border-border bg-surface text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 면접관이 준비 중…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mt-4 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="면접 답변을 입력하세요…"
              className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-brand"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow transition hover:scale-105 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </AppShell>
  );
}
