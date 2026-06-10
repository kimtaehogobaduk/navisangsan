import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BookOpen, Map, PenLine, Mic, Users, ArrowRight, Newspaper } from "lucide-react";

export const Route = createFileRoute("/more")({
  head: () => ({ meta: [{ title: "더보기 — NAVI" }] }),
  component: MorePage,
});

const FEATURES = [
  {
    to: "/news",
    icon: Newspaper,
    title: "입시정보",
    desc: "실시간 입시 뉴스 · 정책 변화 알림",
    badge: null,
  },
  {
    to: "/subjects",
    icon: BookOpen,
    title: "선택과목 추천",
    desc: "고교학점제 최적 과목 조합 AI 설계",
    badge: null,
  },
  {
    to: "/curriculum",
    icon: Map,
    title: "커리큘럼 허브",
    desc: "EBS 강의 · 추천 도서 · 공모전 전략",
    badge: null,
  },
  {
    to: "/jasoseo",
    icon: PenLine,
    title: "자소서 AI 첨삭",
    desc: "대치동 수준 자기소개서 피드백",
    badge: "킬러",
  },
  {
    to: "/interview",
    icon: Mic,
    title: "면접 시뮬레이터",
    desc: "AI 면접관과 실전 연습 + 피드백",
    badge: null,
  },
  {
    to: "/parent",
    icon: Users,
    title: "학부모 뷰",
    desc: "자녀 진행 현황 · 주간 리포트",
    badge: null,
  },
] as const;

function MorePage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">추가 기능</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          진로 컨설팅의 나머지 도구들을 모두 활용해보세요.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link
              key={f.to}
              to={f.to}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-brand/40 hover:bg-surface-elevated"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{f.title}</span>
                  {f.badge && (
                    <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand">
                      {f.badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-brand/20 bg-brand/5 p-5">
        <p className="text-sm font-semibold">💡 NAVI 활용 가이드</p>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">고1 골든타임:</span> 선택과목 추천 → 생기부 빌더 → 커리큘럼 허브 순으로 활용
          </li>
          <li>
            <span className="font-medium text-foreground">고2 스펙 실행:</span> AI 코치 + 공모전 전략 + 자소서 초안 작성
          </li>
          <li>
            <span className="font-medium text-foreground">고3 원서 최적화:</span> 전형 분석 → 자소서 첨삭 → 면접 시뮬레이터
          </li>
        </ul>
      </div>
    </AppShell>
  );
}
