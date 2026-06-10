import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { aiCoachChat } from "@/lib/ai.functions";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Markdown } from "@/components/Markdown";

export const Route = createFileRoute("/coach")({
  head: () => ({ meta: [{ title: "AI 코치 — NAVI" }] }),
  component: Coach,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "내 상황에서 수시 vs 정시 비중 어떻게 가져갈까?",
  "고교학점제 선택과목 어떻게 골라야 해?",
  "다음 모의고사까지 1달, 우선순위 과목은?",
  "자소서 첫 문장 어떻게 시작하면 좋을까?",
];

function Coach() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(aiCoachChat);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      (markProfileRequired("AI 코치"), navigate({ to: "/onboarding" }));
      return;
    }
    setProfile(p);
    const cached = localStorage.getItem("navi.coach.history.v1");
    if (cached) setMessages(JSON.parse(cached));
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    localStorage.setItem("navi.coach.history.v1", JSON.stringify(messages));
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading || !profile) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { reply } = await chat({
        data: { messages: next, profile },
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "응답 실패"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">AI 코치</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cerebras 초고속 추론 · {profile?.name}님의 프로필 기반 1:1 상담
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex h-[55vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-surface/50 p-4"
      >
        {messages.length === 0 && (
          <div className="m-auto max-w-md text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              무엇이든 물어보세요. 학습 전략부터 멘탈 케어까지.
            </p>
            <div className="mt-6 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition hover:border-brand/40 hover:bg-surface-elevated"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
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
              <Loader2 className="h-4 w-4 animate-spin" /> 생각 중…
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
          placeholder="질문을 입력하세요…"
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
    </AppShell>
  );
}
