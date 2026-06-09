import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Newspaper, RefreshCw, Filter, ChevronDown, ChevronUp, Star, BookOpen, Stethoscope, GraduationCap, FileText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";

// ── Server function: DB에서 입시 정보 불러오기 ──────────────────────────────
const getAdmissionsInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { getAllAdmissionsInfo, getLastFetchedAt } = await import("@/lib/db.server");
  const [items, lastFetched] = await Promise.all([
    getAllAdmissionsInfo(),
    getLastFetchedAt(),
  ]);

  // 데이터가 비어있거나 6시간 이상 지났으면 자동으로 백그라운드 수집 시작
  const ageMs = lastFetched ? Date.now() - new Date(lastFetched).getTime() : Infinity;
  const STALE_MS = 6 * 60 * 60 * 1000;
  if (items.length === 0 || ageMs > STALE_MS) {
    const { startAdmissionsWorker } = await import("@/lib/admissions.worker");
    startAdmissionsWorker().catch(console.error);
  }

  return { items, lastFetched: lastFetched?.toISOString() ?? null };
});

const triggerRefresh = createServerFn({ method: "POST" }).handler(async () => {
  const { triggerManualRefresh } = await import("@/lib/admissions.worker");
  triggerManualRefresh().catch(console.error); // 비동기 — 즉시 응답
  return { ok: true };
});

// ── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "입시 정보 — NAVI" },
      { name: "description", content: "AI 자동 수집 대입 입시 정보 — 대학별/학년별 분류" },
    ],
  }),
  component: AdmissionsNews,
});

type InfoItem = {
  id: number;
  topic_key: string;
  title: string;
  summary: string;
  bullets: string[];
  target_grade: string;
  universities: string[];
  info_type: string;
  importance: number;
  fetched_at: string;
};

type FilterGrade = "전체" | "고2이하" | "고3n수" | "공통";
type FilterType = "전체" | "모집요강" | "의대약대" | "정책변경" | "수능" | "입시전략" | "입시정보";

const TYPE_ICONS: Record<string, React.ElementType> = {
  모집요강: BookOpen,
  의대약대: Stethoscope,
  정책변경: FileText,
  수능: GraduationCap,
  입시전략: TrendingUp,
  입시정보: Newspaper,
};

const TYPE_COLORS: Record<string, string> = {
  모집요강: "text-blue-400 bg-blue-500/15",
  의대약대: "text-rose-400 bg-rose-500/15",
  정책변경: "text-amber-400 bg-amber-500/15",
  수능: "text-purple-400 bg-purple-500/15",
  입시전략: "text-emerald-400 bg-emerald-500/15",
  입시정보: "text-slate-300 bg-slate-500/15",
};

const GRADE_COLORS: Record<string, string> = {
  고2이하: "text-cyan-400 bg-cyan-500/15",
  고3n수: "text-orange-400 bg-orange-500/15",
  공통: "text-slate-300 bg-slate-500/15",
};

const GRADE_LABELS: Record<string, string> = {
  고2이하: "고2 이하",
  고3n수: "고3·N수",
  공통: "공통",
};

function ImportanceStars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function InfoCard({ item }: { item: InfoItem }) {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_ICONS[item.info_type] ?? Newspaper;
  const typeColor = TYPE_COLORS[item.info_type] ?? TYPE_COLORS["입시정보"];
  const gradeColor = GRADE_COLORS[item.target_grade] ?? GRADE_COLORS["공통"];
  const gradeLabel = GRADE_LABELS[item.target_grade] ?? item.target_grade;
  const fetched = new Date(item.fetched_at);
  const timeAgo = formatTimeAgo(fetched);

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/80 p-4 transition hover:border-border">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${typeColor}`}>
            <TypeIcon className="h-3 w-3" />
            {item.info_type}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${gradeColor}`}>
            {gradeLabel}
          </span>
          {item.universities.slice(0, 2).map((u) => (
            <span key={u} className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
              {u}
            </span>
          ))}
          {item.universities.length > 2 && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
              +{item.universities.length - 2}
            </span>
          )}
        </div>
        <ImportanceStars n={item.importance} />
      </div>

      {/* Title */}
      <h3 className="mb-1.5 text-sm font-semibold leading-snug text-foreground">
        {item.title}
      </h3>

      {/* Summary */}
      <p className="text-xs leading-relaxed text-muted-foreground">{item.summary}</p>

      {/* Bullets (collapsible) */}
      {item.bullets?.length > 0 && (
        <>
          {expanded && (
            <ul className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
              {item.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-xs text-foreground/80">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-500/70" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "접기" : `핵심 포인트 ${item.bullets.length}개 보기`}
          </button>
        </>
      )}

      {/* Footer */}
      <p className="mt-3 text-[10px] text-muted-foreground/50">{timeAgo} 업데이트</p>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "방금";
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}일 전`;
}

const GRADE_FILTER_LABELS: Record<FilterGrade, string> = {
  전체: "전체",
  고2이하: "고2 이하",
  고3n수: "고3·N수",
  공통: "공통",
};

const TYPE_FILTER_LABELS: Record<FilterType, string> = {
  전체: "전체",
  모집요강: "모집요강",
  의대약대: "의대·약대",
  정책변경: "정책변경",
  수능: "수능",
  입시전략: "입시전략",
  입시정보: "입시정보",
};

function AdmissionsNews() {
  const [items, setItems] = useState<InfoItem[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<FilterGrade>("전체");
  const [typeFilter, setTypeFilter] = useState<FilterType>("전체");
  const [empty, setEmpty] = useState(false);

  async function loadData() {
    try {
      const data = await getAdmissionsInfo();
      setItems(data.items);
      setLastFetched(data.lastFetched);
      setEmpty(data.items.length === 0);
    } catch (e) {
      console.error(e);
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
      // 5초 후 데이터 리로드 (백그라운드 작업 완료 대기)
      setTimeout(() => loadData(), 5000);
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = items.filter((item) => {
    if (gradeFilter !== "전체" && item.target_grade !== gradeFilter) return false;
    if (typeFilter !== "전체" && item.info_type !== typeFilter) return false;
    return true;
  });

  const highImportance = filtered.filter((i) => i.importance >= 4);
  const rest = filtered.filter((i) => i.importance < 4);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Newspaper className="h-5 w-5 text-cyan-400" />
              입시 정보
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI가 6시간마다 자동 수집 · 분석 · 업데이트
              {lastFetched && (
                <span className="ml-2 text-muted-foreground/60">
                  마지막 수집: {formatTimeAgo(new Date(lastFetched))}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground transition hover:border-cyan-500/40 hover:text-cyan-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "수집 중…" : "지금 업데이트"}
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Grade filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(GRADE_FILTER_LABELS) as FilterGrade[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    gradeFilter === g
                      ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {GRADE_FILTER_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_FILTER_LABELS) as FilterType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    typeFilter === t
                      ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {TYPE_FILTER_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface/60" />
            ))}
          </div>
        ) : empty ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">입시 정보를 수집 중입니다</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              서버 시작 직후 자동 수집이 진행됩니다.<br />
              "지금 업데이트" 버튼을 눌러 수동으로 시작할 수도 있습니다.
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-4 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              {refreshing ? "수집 중…" : "지금 수집 시작"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            선택한 필터에 맞는 정보가 없습니다.
          </div>
        ) : (
          <div className="space-y-6">
            {/* High importance items */}
            {highImportance.length > 0 && (
              <section className="space-y-3">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  주요 정보 ({highImportance.length})
                </h2>
                <div className="space-y-3">
                  {highImportance.map((item) => (
                    <InfoCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Rest */}
            {rest.length > 0 && (
              <section className="space-y-3">
                {highImportance.length > 0 && (
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    추가 정보 ({rest.length})
                  </h2>
                )}
                <div className="space-y-3">
                  {rest.map((item) => (
                    <InfoCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer notice */}
        <p className="text-center text-[10px] text-muted-foreground/40 pb-4">
          AI 기반 자동 수집 정보입니다. 중요한 입시 결정 전 공식 대학 발표를 반드시 확인하세요.
        </p>
      </div>
    </AppShell>
  );
}
