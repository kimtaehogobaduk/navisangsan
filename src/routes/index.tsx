import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, FileText, Sparkles, Target, MessageCircle, Map } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NAVI — AI 진로 컨설팅 플랫폼" },
      {
        name: "description",
        content:
          "강남 컨설팅 100만원을 AI로. 전국 누구에게나. 고교학점제부터 수시 6장 최적 조합까지 NAVI가 함께합니다.",
      },
      { property: "og:title", content: "NAVI — AI 진로 컨설팅 플랫폼" },
      {
        property: "og:description",
        content: "강남 컨설팅 100만원을 AI로. 전국 누구에게나.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Brain,
    title: "진단 엔진",
    desc: "내신·모의고사·관심분야 입력 10분 → 전구간 맞춤 로드맵 자동 생성",
  },
  {
    icon: FileText,
    title: "생기부 AI 빌더",
    desc: "활동만 입력하면 목표 학과 키워드가 녹아든 세특 문구 자동 생성 (킬러 피처)",
  },
  {
    icon: Target,
    title: "전형 시뮬레이터",
    desc: "수시 학종/교과/논술 · 정시 비중 최적화. 지원 가능 대학 추천",
  },
  {
    icon: Map,
    title: "월별 실행 플랜",
    desc: "공공 데이터(EBS·도서관·공모전) 통합 → 진행률 추적까지",
  },
  {
    icon: MessageCircle,
    title: "AI 코치 (24시간)",
    desc: "Cerebras 초고속 추론 엔진 기반 1:1 진로 상담 · 자소서 피드백",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">NAVI</span>
        </div>
        <Link
          to="/login"
          className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground transition hover:bg-surface-elevated"
        >
          시작하기
        </Link>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand shadow-glow" />
          제 12회 부산 창업 아이디어 경진대회 · 팀 나비엔
        </div>
        <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
          강남 컨설팅 100만원을{" "}
          <span className="text-gradient-brand">AI로.</span>
          <br />
          전국 누구에게나.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          NAVI는 중2부터 고3까지 6년 입시 전구간을 한 앱으로 커버합니다. 고교학점제 선택과목부터 생기부 세특,
          수시 6장 최적 조합까지 — AI 코치가 1:1로 설계합니다.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.02]"
          >
            10분 진단 시작 <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/coach"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
          >
            AI 코치 먼저 체험
          </Link>
        </div>

        {/* Gap stats */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <Stat value="29.2조원" label="2024 초중고 사교육비" />
          <Stat value="50~100만원" label="강남 컨설팅 1회 50분" highlight />
          <Stat value="6배" label="서울 내 지역간 단가 격차" />
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold md:text-3xl">
          AI가 대신 짜주는 <span className="text-gradient-brand">완전 개인화 입시 전략</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          국내 어디에도 없는 — 진단 + 생기부 + 전형 + 로드맵 + 코치, 다섯 가지 통합 서비스.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-brand/40 hover:bg-surface-elevated"
            >
              <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-xl font-semibold leading-relaxed md:text-2xl">
          “강남 학생은 수십만 원짜리 컨설팅으로 해결하는 문제를,
          <br />
          전북 익산 학생은 <span className="text-gradient-brand">NAVI</span>로 해결한다.”
        </p>
        <p className="mt-4 text-xs text-muted-foreground">— NAVI의 존재 이유</p>

        <div className="mt-10">
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-8 py-4 text-base font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.02]"
          >
            지금 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © 2026 NAVI · 팀 나비엔 · Powered by Cerebras Inference
      </footer>
    </div>
  );
}

function Stat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight ? "border-brand/40 bg-surface-elevated shadow-glow" : "border-border bg-surface"
      }`}
    >
      <div className={`text-3xl font-bold tracking-tight ${highlight ? "text-gradient-brand" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
