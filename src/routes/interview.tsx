import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, type StudentProfile } from "@/lib/profile";
import { markProfileRequired } from "@/lib/require-profile";
import { getInterviewFeedback, generateEssayInterviewQuestions, generateCommonInterviewQuestions } from "@/lib/ai.functions";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import InterviewVideoPreview, { type VideoPreviewHandle } from "@/components/InterviewVideoPreview";
import AudioRadarChart from "@/components/AudioRadarChart";
import { Markdown } from "@/components/Markdown";
import {
  Mic, Square, Send, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Video, VideoOff, RotateCcw, Sparkles, BookOpen, FileText, Volume2,
} from "lucide-react";

export const Route = createFileRoute("/interview")({
  head: () => ({ meta: [{ title: "면접 시뮬레이터 — NAVI" }] }),
  component: InterviewPage,
});

// ──────────── 공통 면접 질문 fallback (AI 생성 실패 시) ────────────
const FALLBACK_COMMON_QUESTIONS = [
  "자기소개를 1분 안에 해주세요.",
  "우리 학교/학과에 지원한 동기는 무엇인가요?",
  "본인의 가장 큰 장점과 단점은 무엇인가요?",
  "고등학교 생활 중 가장 기억에 남는 경험은 무엇인가요?",
  "어려운 상황에서 포기하지 않고 끝까지 해낸 경험을 말해주세요.",
  "팀 프로젝트에서 갈등이 생겼을 때 어떻게 해결했나요?",
  "리더십을 발휘한 경험이 있다면 구체적으로 말해주세요.",
  "가장 어려웠던 과목을 어떻게 극복했나요?",
  "본인이 지원한 전공에 관심을 갖게 된 계기는 무엇인가요?",
  "10년 후 본인의 모습을 어떻게 그리고 있나요?",
];

// ──────────── 타입 ────────────
type Mode = "common" | "essay";

interface FeedbackItem {
  question: string;
  answer: string;
  feedback: string;
  score: number | null;
  audioScores: AudioScores | null;
  isVoice: boolean;
  followUpQuestion: string | null;
}

interface AudioScores {
  pronunciation: number;
  speed: number;
  fluency: number;
  intonation: number;
  delivery: number;
}

// ──────────── 메인 컴포넌트 ────────────
function InterviewPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [mode, setMode] = useState<Mode>("common");

  // 공통 면접 상태
  const [qIdx, setQIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");

  // 자소서 기반 상태
  const [essay, setEssay] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("navi.interview.essay.v1") ?? "" : ""
  );
  const [essayQuestions, setEssayQuestions] = useState<string[]>([]);
  const [essayQIdx, setEssayQIdx] = useState(0);
  const [essayAnswer, setEssayAnswer] = useState("");
  const [essayFeedbackList, setEssayFeedbackList] = useState<FeedbackItem[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const essaySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 카메라
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<VideoPreviewHandle>(null);

  // 음성 인식
  const speech = useSpeechRecognition();

  // 서버 함수
  const getFeedback = useServerFn(getInterviewFeedback);
  const genQuestions = useServerFn(generateEssayInterviewQuestions);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = loadProfile();
    if (!p) { (markProfileRequired("면접 시뮬레이터"), navigate({ to: "/onboarding" })); return; }
    setProfile(p);
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [feedbackList, essayFeedbackList]);

  // 자소서 자동 저장
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (essaySaveRef.current) clearTimeout(essaySaveRef.current);
    essaySaveRef.current = setTimeout(() => {
      localStorage.setItem("navi.interview.essay.v1", essay);
    }, 2000);
  }, [essay]);

  // ── 공통: 피드백 제출 ──
  async function handleSubmitCommon(useVoice = false) {
    const ans = (useVoice ? speech.transcript : answer).trim();
    if (!ans || !profile) return;
    setLoading(true);
    const q = COMMON_QUESTIONS[qIdx];
    const voiceMetrics = useVoice
      ? {
          wordsPerMinute: speech.duration > 0 ? Math.round((speech.wordCount / speech.duration) * 60) : 0,
          wordCount: speech.wordCount,
          durationSec: Math.round(speech.duration),
        }
      : undefined;
    try {
      const res = await getFeedback({
        data: { question: q, answer: ans, profile, mode: "common", isVoice: useVoice, voiceMetrics },
      });
      setFeedbackList((prev) => [
        ...prev,
        {
          question: q,
          answer: ans,
          feedback: res!.feedback,
          score: res!.score,
          audioScores: res!.audioScores ?? null,
          isVoice: useVoice,
          followUpQuestion: res!.followUpQuestion ?? null,
        },
      ]);
      setPendingFollowUp(res!.followUpQuestion ?? null);
      setAnswer("");
      speech.resetTranscript();
    } catch (e) {
      alert(e instanceof Error ? e.message : "피드백 오류");
    } finally {
      setLoading(false);
    }
  }

  // ── 공통: 꼬리 질문 제출 ──
  async function handleFollowUp() {
    if (!followUpAnswer.trim() || !pendingFollowUp || !profile) return;
    setLoading(true);
    try {
      const res = await getFeedback({
        data: { question: pendingFollowUp, answer: followUpAnswer, profile, mode: "followup" },
      });
      setFeedbackList((prev) => [
        ...prev,
        {
          question: pendingFollowUp,
          answer: followUpAnswer,
          feedback: res!.feedback,
          score: res!.score,
          audioScores: null,
          isVoice: false,
          followUpQuestion: res!.followUpQuestion ?? null,
        },
      ]);
      setPendingFollowUp(res!.followUpQuestion ?? null);
      setFollowUpAnswer("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "피드백 오류");
    } finally {
      setLoading(false);
    }
  }

  // ── 자소서: 질문 생성 ──
  async function handleGenerateQuestions() {
    if (!essay.trim() || !profile) return;
    setGeneratingQuestions(true);
    setEssayFeedbackList([]);
    setEssayQIdx(0);
    try {
      const res = await genQuestions({ data: { essay, profile } });
      setEssayQuestions(res!.questions ?? []);
    } catch (e) {
      alert(e instanceof Error ? e.message : "질문 생성 오류");
    } finally {
      setGeneratingQuestions(false);
    }
  }

  // ── 자소서: 피드백 제출 ──
  async function handleSubmitEssay(useVoice = false) {
    const ans = (useVoice ? speech.transcript : essayAnswer).trim();
    if (!ans || !profile || essayQuestions.length === 0) return;
    setLoading(true);
    const q = essayQuestions[essayQIdx];
    const voiceMetrics = useVoice
      ? {
          wordsPerMinute: speech.duration > 0 ? Math.round((speech.wordCount / speech.duration) * 60) : 0,
          wordCount: speech.wordCount,
          durationSec: Math.round(speech.duration),
        }
      : undefined;
    try {
      const res = await getFeedback({
        data: { question: q, answer: ans, profile, mode: "essay", essay, isVoice: useVoice, voiceMetrics },
      });
      setEssayFeedbackList((prev) => [
        ...prev,
        {
          question: q,
          answer: ans,
          feedback: res!.feedback,
          score: res!.score,
          audioScores: res!.audioScores ?? null,
          isVoice: useVoice,
          followUpQuestion: res!.followUpQuestion ?? null,
        },
      ]);
      setEssayAnswer("");
      speech.resetTranscript();
    } catch (e) {
      alert(e instanceof Error ? e.message : "피드백 오류");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setFeedbackList([]);
    setEssayFeedbackList([]);
    setEssayQuestions([]);
    setAnswer("");
    setEssayAnswer("");
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    speech.resetTranscript();
  }

  const currentCommonQ = COMMON_QUESTIONS[qIdx];
  const currentEssayQ = essayQuestions[essayQIdx] ?? null;

  return (
    <AppShell>
      {/* 헤더 */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">면접 시뮬레이터</h1>
            <p className="text-xs text-muted-foreground">AI 면접관 · 실시간 채점 · 꼬리 질문</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCameraOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              cameraOn
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/30 hover:text-foreground"
            }`}
          >
            {cameraOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
            카메라
          </button>
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-brand/30 hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 초기화
          </button>
        </div>
      </div>

      {/* 모드 탭 */}
      <div className="mb-5 flex gap-2 rounded-2xl border border-border bg-surface p-1">
        {([
          { id: "common", label: "공통 면접", icon: BookOpen, desc: "인성·일반·상황 질문" },
          { id: "essay", label: "자소서 기반", icon: FileText, desc: "자기소개서 맞춤 질문" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id as Mode)}
            className={`flex flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              mode === t.id
                ? "bg-gradient-brand text-brand-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="font-semibold leading-tight">{t.label}</div>
              <div className={`text-xs leading-tight ${mode === t.id ? "opacity-80" : "text-muted-foreground"}`}>
                {t.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 본문 */}
      <div className={`grid gap-5 ${cameraOn ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        <div className={cameraOn ? "lg:col-span-2 space-y-5" : "space-y-5"} ref={scrollRef}>

          {/* ══════ 공통 면접 ══════ */}
          {mode === "common" && (
            <>
              {/* 질문 카드 */}
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    질문 {qIdx + 1} / {COMMON_QUESTIONS.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setQIdx((i) => (i - 1 + COMMON_QUESTIONS.length) % COMMON_QUESTIONS.length); setAnswer(""); speech.resetTranscript(); }}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setQIdx((i) => (i + 1) % COMMON_QUESTIONS.length); setAnswer(""); speech.resetTranscript(); }}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setQIdx(Math.floor(Math.random() * COMMON_QUESTIONS.length)); setAnswer(""); speech.resetTranscript(); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> 랜덤
                    </button>
                  </div>
                </div>
                <p className="text-base font-semibold leading-relaxed">{currentCommonQ}</p>
              </div>

              {/* 답변 입력 */}
              <AnswerInput
                transcript={speech.transcript}
                isListening={speech.isListening}
                wordCount={speech.wordCount}
                duration={speech.duration}
                textAnswer={answer}
                onTextChange={setAnswer}
                onStartListening={speech.startListening}
                onStopListening={speech.stopListening}
                onSubmitText={() => handleSubmitCommon(false)}
                onSubmitVoice={() => handleSubmitCommon(true)}
                loading={loading}
              />

              {/* 피드백 목록 */}
              {feedbackList.map((item, i) => (
                <FeedbackCard key={i} item={item} index={i} />
              ))}

              {/* 꼬리 질문 */}
              {pendingFollowUp && (
                <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-brand" />
                    <span className="text-sm font-semibold text-brand">꼬리 질문</span>
                  </div>
                  <p className="text-sm font-medium mb-3">{pendingFollowUp}</p>
                  <div className="flex gap-2">
                    <textarea
                      value={followUpAnswer}
                      onChange={(e) => setFollowUpAnswer(e.target.value)}
                      placeholder="꼬리 질문에 답변하세요…"
                      rows={3}
                      className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand"
                    />
                    <button
                      onClick={handleFollowUp}
                      disabled={loading || !followUpAnswer.trim()}
                      className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow transition hover:scale-105 disabled:opacity-50 self-end"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════ 자소서 기반 ══════ */}
          {mode === "essay" && (
            <>
              {/* 자소서 입력 */}
              {essayQuestions.length === 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold">자기소개서 입력</h2>
                    <span className="text-xs text-muted-foreground">자동 저장 중</span>
                  </div>
                  <textarea
                    value={essay}
                    onChange={(e) => setEssay(e.target.value)}
                    placeholder="자기소개서 내용을 붙여넣거나 직접 작성하세요. AI가 이 내용을 바탕으로 맞춤 면접 질문 5개를 생성합니다."
                    rows={12}
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-brand"
                  />
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={generatingQuestions || essay.trim().length < 50}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
                  >
                    {generatingQuestions ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> 질문 생성 중…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> 맞춤 면접 질문 생성</>
                    )}
                  </button>
                  {essay.trim().length > 0 && essay.trim().length < 50 && (
                    <p className="mt-2 text-xs text-muted-foreground text-center">자소서를 50자 이상 입력하세요</p>
                  )}
                </div>
              )}

              {/* 자소서 질문 + 답변 */}
              {essayQuestions.length > 0 && (
                <>
                  {/* 질문 카드 */}
                  <div className="rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          질문 {essayQIdx + 1} / {essayQuestions.length}
                        </span>
                        <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-brand">
                          자소서 기반
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEssayQIdx((i) => Math.max(0, i - 1)); setEssayAnswer(""); speech.resetTranscript(); }}
                          disabled={essayQIdx === 0}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition disabled:opacity-30"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEssayQIdx((i) => Math.min(essayQuestions.length - 1, i + 1)); setEssayAnswer(""); speech.resetTranscript(); }}
                          disabled={essayQIdx === essayQuestions.length - 1}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEssayQuestions([]); setEssayFeedbackList([]); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> 재생성
                        </button>
                      </div>
                    </div>
                    {/* 질문 목록 */}
                    <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
                      {essayQuestions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => { setEssayQIdx(i); setEssayAnswer(""); speech.resetTranscript(); }}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            i === essayQIdx
                              ? "bg-brand text-brand-foreground"
                              : "border border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Q{i + 1}
                        </button>
                      ))}
                    </div>
                    <p className="text-base font-semibold leading-relaxed">{currentEssayQ}</p>
                  </div>

                  <AnswerInput
                    transcript={speech.transcript}
                    isListening={speech.isListening}
                    wordCount={speech.wordCount}
                    duration={speech.duration}
                    textAnswer={essayAnswer}
                    onTextChange={setEssayAnswer}
                    onStartListening={speech.startListening}
                    onStopListening={speech.stopListening}
                    onSubmitText={() => handleSubmitEssay(false)}
                    onSubmitVoice={() => handleSubmitEssay(true)}
                    loading={loading}
                  />

                  {/* 피드백 */}
                  {essayFeedbackList.map((item, i) => (
                    <FeedbackCard key={i} item={item} index={i} />
                  ))}
                </>
              )}
            </>
          )}

          {/* 로딩 */}
          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> AI가 채점 중입니다…
            </div>
          )}
        </div>

        {/* 카메라 */}
        {cameraOn && (
          <div className="space-y-4">
            <InterviewVideoPreview ref={videoRef} />
            <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">💡 면접 자세 체크리스트</p>
              <p>• 카메라 정면을 바라보며 말하기</p>
              <p>• 손을 가지런히 모으고 상체 자세 유지</p>
              <p>• 적절한 속도로 또렷하게 발음하기</p>
              <p>• 답변은 두괄식 (결론 → 근거 → 마무리)</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ──────────── 답변 입력 컴포넌트 ────────────
function AnswerInput({
  transcript, isListening, wordCount, duration,
  textAnswer, onTextChange,
  onStartListening, onStopListening,
  onSubmitText, onSubmitVoice,
  loading,
}: {
  transcript: string;
  isListening: boolean;
  wordCount: number;
  duration: number;
  textAnswer: string;
  onTextChange: (v: string) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onSubmitText: () => void;
  onSubmitVoice: () => void;
  loading: boolean;
}) {
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">답변 입력</p>

      {/* 음성 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={isListening ? onStopListening : onStartListening}
          disabled={loading}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
            isListening
              ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
              : "border border-border hover:border-brand/40 hover:text-foreground text-muted-foreground"
          }`}
        >
          {isListening ? (
            <><Square className="h-4 w-4" /> 음성 인식 중지</>
          ) : (
            <><Volume2 className="h-4 w-4" /> 음성으로 답변</>
          )}
        </button>
        {transcript && !isListening && (
          <button
            onClick={onSubmitVoice}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> 음성 답변 제출
          </button>
        )}
      </div>

      {/* 음성 인식 상태 */}
      {isListening && (
        <div className="flex items-center gap-2 text-red-400 text-xs animate-pulse">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          음성 인식 중… 답변이 끝나면 중지를 누르세요
        </div>
      )}

      {/* 인식된 텍스트 */}
      {transcript && (
        <div className="rounded-xl bg-surface-elevated border border-border/50 p-3 space-y-1.5">
          <p className="text-xs font-medium text-brand">인식된 내용</p>
          <p className="text-sm">{transcript}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>단어 {wordCount}개</span>
            <span>속도 {wpm} 단어/분</span>
            <span>{Math.round(duration)}초</span>
          </div>
        </div>
      )}

      {/* 구분선 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 border-t border-border" />
        <span>또는 텍스트로 입력</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* 텍스트 입력 */}
      <textarea
        value={textAnswer}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="답변을 직접 입력하세요…"
        rows={6}
        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-brand"
        disabled={loading}
      />
      <button
        onClick={onSubmitText}
        disabled={loading || !textAnswer.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> 채점 중…</>
        ) : (
          <><Send className="h-4 w-4" /> 텍스트 답변 제출</>
        )}
      </button>
    </div>
  );
}

// ──────────── 피드백 카드 ────────────
function FeedbackCard({ item, index }: { item: FeedbackItem; index: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-elevated transition text-left"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-surface-elevated border border-border/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            답변 {index + 1}
          </span>
          {item.isVoice && (
            <span className="flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-xs text-brand">
              <Volume2 className="h-3 w-3" /> 음성
            </span>
          )}
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">{item.question}</span>
        </div>
        {item.score !== null && (
          <span className={`text-lg font-bold ${item.score >= 80 ? "text-green-400" : item.score >= 60 ? "text-brand" : "text-orange-400"}`}>
            {item.score}점
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-5 py-4 space-y-4">
          {/* 내 답변 */}
          <div className="rounded-xl bg-surface-elevated p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">내 답변</p>
            <p className="text-sm">{item.answer}</p>
          </div>

          {/* AI 피드백 */}
          <div>
            <p className="text-xs font-medium text-brand mb-2">AI 피드백</p>
            <div className="text-sm">
              <Markdown>{item.feedback}</Markdown>
            </div>
          </div>

          {/* 음성 분석 레이더 */}
          {item.audioScores && <AudioRadarChart scores={item.audioScores} />}
        </div>
      )}
    </div>
  );
}
