import { useState } from "react";
import {
  type RoadmapData, type MonthPlan, type CheckItem, CATEGORY_META,
} from "@/lib/roadmap";
import {
  ChevronDown, ChevronUp, BookOpen, Target, Flame, Clock,
  GraduationCap, Trophy, Brain, CalendarDays, Star, TrendingUp,
  AlertTriangle, CheckCircle2, ListChecks, University,
} from "lucide-react";

const PHASE_COLORS: Record<MonthPlan["phase"], { border: string; bg: string; text: string; badge: string }> = {
  단기: { border: "#6366f1", bg: "#6366f108", text: "#6366f1", badge: "#6366f120" },
  중기: { border: "#8b5cf6", bg: "#8b5cf608", text: "#8b5cf6", badge: "#8b5cf620" },
  장기: { border: "#06b6d4", bg: "#06b6d408", text: "#06b6d4", badge: "#06b6d420" },
};

const PRIORITY_META = {
  high:   { label: "긴급", cls: "text-red-400" },
  medium: { label: "중요", cls: "text-amber-400" },
  low:    { label: "일반", cls: "text-muted-foreground" },
};

export function RoadmapView({
  data,
  done,
  onToggle,
}: {
  data: RoadmapData;
  done: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [activePhase, setActivePhase] = useState(0);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const [appOpen, setAppOpen] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set(["w-0-1"]));

  const month = data.months[activePhase];
  const phaseColor = month ? PHASE_COLORS[month.phase] : PHASE_COLORS["단기"];

  function toggleWeek(key: string) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-5">

      {/* ── 현황 진단 개요 카드 ── */}
      <OverviewCard
        overview={data.overview}
        open={overviewOpen}
        onToggle={() => setOverviewOpen((v) => !v)}
      />

      {/* ── 3개월 요약 비교 표 ── */}
      <SummaryTable months={data.months} done={done} onSelect={(i) => setActivePhase(i)} activePhase={activePhase} />

      {/* ── Phase 탭 선택 ── */}
      <div className="flex gap-2">
        {data.months.map((m, i) => {
          const c = PHASE_COLORS[m.phase];
          const isActive = i === activePhase;
          return (
            <button
              key={i}
              onClick={() => { setActivePhase(i); setExpandedWeeks(new Set([`w-${i}-1`])); }}
              className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition"
              style={{
                borderColor: isActive ? c.border : "var(--border)",
                background: isActive ? c.badge : "var(--surface)",
                color: isActive ? c.text : "var(--muted-foreground)",
              }}
            >
              <div className="text-xs font-medium opacity-70">{m.phase}</div>
              <div className="mt-0.5">{m.monthLabel}</div>
            </button>
          );
        })}
      </div>

      {/* ── 선택된 달 상세 ── */}
      {month && (
        <PhaseDetailCard
          month={month}
          phaseColor={phaseColor}
          phaseIdx={activePhase}
          done={done}
          onToggle={onToggle}
          expandedWeeks={expandedWeeks}
          onToggleWeek={toggleWeek}
        />
      )}

      {/* ── 입시 전략 (수시/정시) ── */}
      <AppStrategyCard
        strategy={data.applicationStrategy}
        open={appOpen}
        onToggle={() => setAppOpen((v) => !v)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Overview Card
// ─────────────────────────────────────────────
function OverviewCard({
  overview, open, onToggle,
}: {
  overview: RoadmapData["overview"]; open: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-brand" />
          <span className="text-sm font-bold text-foreground">AI 현황 진단 요약</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-brand/20 px-5 pb-5 pt-4 space-y-4">
          {/* Diagnosis */}
          <p className="text-sm text-foreground leading-relaxed">{overview.diagnosis}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Strengths */}
            <div>
              <p className="mb-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">강점</p>
              <ul className="space-y-1.5">
                {overview.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            {/* Weaknesses */}
            <div>
              <p className="mb-2 text-xs font-bold text-red-400 uppercase tracking-wide">보완 필요</p>
              <ul className="space-y-1.5">
                {overview.weaknesses?.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Core strategy */}
          <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3">
            <p className="text-xs font-bold text-brand mb-1">핵심 전략</p>
            <p className="text-sm text-foreground">{overview.coreStrategy}</p>
          </div>

          {/* Application ratio */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">수시/정시 비율 권장:</span>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 text-xs font-bold text-amber-400">
              {overview.applicationRatio}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Summary Table (3개월 나란히 비교)
// ─────────────────────────────────────────────
function SummaryTable({
  months, done, onSelect, activePhase,
}: {
  months: MonthPlan[];
  done: Set<string>;
  onSelect: (i: number) => void;
  activePhase: number;
}) {
  const ROWS = [
    { key: "keyEvents",    label: "주요 일정",       icon: CalendarDays },
    { key: "priorities",   label: "TOP 우선순위",    icon: Trophy },
    { key: "studyWeekly",  label: "목표 학습시간",   icon: Clock },
    { key: "studyWeak",    label: "취약 과목 집중",  icon: AlertTriangle },
    { key: "seukuk",       label: "세특 방향",       icon: BookOpen },
    { key: "keyword",      label: "핵심 키워드",     icon: Target },
  ] as const;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-[110px] border-b border-r border-border bg-surface/80 px-3 py-3 text-left text-xs font-semibold text-muted-foreground">
              구분
            </th>
            {months.map((m, i) => {
              const c = PHASE_COLORS[m.phase];
              const isActive = i === activePhase;
              return (
                <th
                  key={i}
                  onClick={() => onSelect(i)}
                  className="border-b border-border px-3 py-3 text-center text-xs font-bold cursor-pointer transition hover:bg-surface-elevated"
                  style={{
                    background: isActive ? c.badge : "var(--surface)",
                    color: isActive ? c.text : "var(--muted-foreground)",
                    borderBottom: isActive ? `2px solid ${c.border}` : undefined,
                  }}
                >
                  <div className="opacity-70">{m.phase}</div>
                  <div className="text-sm mt-0.5">{m.monthLabel}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label, icon: Icon }) => (
            <tr key={key} className="border-b border-border/40 last:border-b-0">
              <td className="border-r border-border/40 bg-surface/50 px-3 py-3 align-top">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </div>
              </td>
              {months.map((m, i) => {
                let content: React.ReactNode = null;
                if (key === "keyEvents") {
                  content = (
                    <ul className="space-y-0.5">
                      {(m.keyEvents ?? []).slice(0, 3).map((e, j) => (
                        <li key={j} className="flex items-start gap-1 text-xs text-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  );
                } else if (key === "priorities") {
                  content = (
                    <ul className="space-y-0.5">
                      {(m.priorities ?? []).map((p, j) => (
                        <li key={j} className="text-[11px] text-foreground leading-snug">{p}</li>
                      ))}
                    </ul>
                  );
                } else if (key === "studyWeekly") {
                  content = (
                    <span className="font-bold text-brand text-sm">
                      {m.studyStrategy?.weeklyHours ?? "—"}시간/주
                    </span>
                  );
                } else if (key === "studyWeak") {
                  content = (
                    <span className="text-xs text-foreground">
                      {m.studyStrategy?.weakSubject?.split(":")[0] ?? "—"}
                    </span>
                  );
                } else if (key === "seukuk") {
                  content = (
                    <ul className="space-y-0.5">
                      {(m.recordStrategy?.seukuk ?? []).slice(0, 2).map((s, j) => (
                        <li key={j} className="text-[11px] text-foreground leading-snug">
                          <span className="text-emerald-400 mr-1">·</span>{s}
                        </li>
                      ))}
                    </ul>
                  );
                } else if (key === "keyword") {
                  content = (
                    <span className="inline-block rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium"
                      style={{ color: PHASE_COLORS[m.phase].text, background: PHASE_COLORS[m.phase].badge }}
                    >
                      {m.recordStrategy?.keyKeyword ?? "—"}
                    </span>
                  );
                }

                // Done progress for this month
                const monthItems = m.checkItems ?? [];
                const monthDone = monthItems.filter((c) => done.has(c.id)).length;
                const monthPct = monthItems.length ? Math.round((monthDone / monthItems.length) * 100) : 0;
                const c = PHASE_COLORS[m.phase];

                return (
                  <td
                    key={i}
                    className="border-r border-border/40 last:border-r-0 px-3 py-3 align-top text-left"
                    style={{ background: i === activePhase ? c.bg : undefined }}
                  >
                    {content}
                    {key === "keyEvents" && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{monthDone}/{monthItems.length} 완료</span>
                          <span className="text-[10px] font-bold" style={{ color: c.text }}>{monthPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${monthPct}%`, background: c.border }} />
                        </div>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// Phase Detail Card
// ─────────────────────────────────────────────
function PhaseDetailCard({
  month, phaseColor, phaseIdx, done, onToggle, expandedWeeks, onToggleWeek,
}: {
  month: MonthPlan;
  phaseColor: typeof PHASE_COLORS[keyof typeof PHASE_COLORS];
  phaseIdx: number;
  done: Set<string>;
  onToggle: (id: string) => void;
  expandedWeeks: Set<string>;
  onToggleWeek: (key: string) => void;
}) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${phaseColor.border}44` }}
    >
      {/* Phase header */}
      <div className="px-5 py-4 border-b" style={{ background: phaseColor.badge, borderColor: `${phaseColor.border}33` }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: phaseColor.border, color: "#fff" }}
              >
                {month.phase}
              </span>
              <span className="text-lg font-bold" style={{ color: phaseColor.text }}>{month.monthLabel}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(month.keyEvents ?? []).map((ev, i) => (
                <span key={i} className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{ borderColor: `${phaseColor.border}40`, color: phaseColor.text, background: `${phaseColor.border}10` }}
                >
                  <CalendarDays className="h-3 w-3" /> {ev}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            {(() => {
              const items = month.checkItems ?? [];
              const doneCount = items.filter((c) => done.has(c.id)).length;
              const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
              return (
                <>
                  <div className="text-2xl font-bold" style={{ color: phaseColor.text }}>{pct}%</div>
                  <div className="text-[10px] text-muted-foreground">이번 달</div>
                </>
              );
            })()}
          </div>
        </div>

        {/* TOP 3 priorities */}
        <div className="mt-4 space-y-1.5">
          {(month.priorities ?? []).map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="shrink-0 font-bold" style={{ color: phaseColor.text }}>
                {i + 1}.
              </span>
              {p}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-6 bg-background/40">

        {/* ── 과목별 학습 전략 표 ── */}
        <Section icon={GraduationCap} title="과목별 학습 전략" color={phaseColor.text}>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface/80">
                  <th className="border-b border-r border-border/50 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-20">과목</th>
                  <th className="border-b border-border/50 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">전략 포인트</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "국어", value: month.studyStrategy?.korean },
                  { label: "수학", value: month.studyStrategy?.math },
                  { label: "영어", value: month.studyStrategy?.english },
                  { label: "탐구/사회", value: month.studyStrategy?.scienceOrSociety },
                  { label: "⚠️ 취약 집중", value: month.studyStrategy?.weakSubject, highlight: true },
                  { label: "주간 목표", value: `${month.studyStrategy?.weeklyHours ?? "—"}시간 / 주`, bold: true },
                ].map(({ label, value, highlight, bold }) => (
                  <tr key={label} className="border-b border-border/30 last:border-b-0">
                    <td className={`border-r border-border/30 px-3 py-2.5 text-xs font-semibold align-top ${highlight ? "text-red-400" : "text-muted-foreground"}`}>
                      {label}
                    </td>
                    <td className={`px-3 py-2.5 text-xs align-top ${highlight ? "text-red-300 bg-red-500/5" : ""} ${bold ? "font-bold text-brand" : "text-foreground"}`}>
                      {value ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 3열: 수능 | 생기부 | 멘탈·건강 ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* 수능 대비 */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-bold text-foreground">수능 대비 포인트</span>
            </div>
            <div className="space-y-2.5">
              <StrategyItem label="이달 핵심" value={month.examStrategy?.focus} color="#8b5cf6" />
              <StrategyItem label="모의고사 활용" value={month.examStrategy?.mockExam} color="#8b5cf6" />
              <StrategyItem label="문제유형 연습" value={month.examStrategy?.practiceType} color="#8b5cf6" />
            </div>
          </div>

          {/* 생기부 전략 */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold text-foreground">생기부 전략</span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-emerald-400 mb-1">세특 아이디어</p>
                <ul className="space-y-1">
                  {(month.recordStrategy?.seukuk ?? []).map((s, i) => (
                    <li key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <StrategyItem label="동아리/자율" value={month.recordStrategy?.activity} color="#10b981" />
              <StrategyItem label="진로 활동" value={month.recordStrategy?.careerActivity} color="#10b981" />
              <div className="mt-1 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2 py-1.5">
                <span className="text-[10px] font-bold text-emerald-400">핵심 키워드: </span>
                <span className="text-[11px] text-foreground">{month.recordStrategy?.keyKeyword}</span>
              </div>
            </div>
          </div>

          {/* 멘탈·건강 + 자소서 */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-pink-400" />
              <span className="text-xs font-bold text-foreground">멘탈·건강 관리</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{month.mentalStrategy}</p>
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400">자소서/면접 전략</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{month.essayStrategy}</p>
            </div>
          </div>
        </div>

        {/* ── 주간 체크리스트 ── */}
        <Section icon={ListChecks} title="주간 실행 체크리스트" color={phaseColor.text}>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((week) => {
              const items = (month.checkItems ?? []).filter((c) => c.week === week);
              if (!items.length) return null;
              const weekKey = `w-${phaseIdx}-${week}`;
              const isOpen = expandedWeeks.has(weekKey);
              const weekDone = items.filter((c) => done.has(c.id)).length;

              return (
                <div key={week} className="rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => onToggleWeek(weekKey)}
                    className="flex w-full items-center gap-3 bg-surface px-4 py-3 hover:bg-surface-elevated transition"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: phaseColor.border }}
                    >
                      {week}
                    </div>
                    <span className="flex-1 text-left text-sm font-semibold text-foreground">
                      {week}주차
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {weekDone}/{items.length} 완료
                    </span>
                    {isOpen
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-background/40 p-3 space-y-2">
                      {items.map((item) => (
                        <CheckItemRow
                          key={item.id}
                          item={item}
                          checked={done.has(item.id)}
                          onToggle={() => onToggle(item.id)}
                          phaseColor={phaseColor.border}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Check Item Row
// ─────────────────────────────────────────────
function CheckItemRow({
  item, checked, onToggle, phaseColor,
}: {
  item: CheckItem; checked: boolean; onToggle: () => void; phaseColor: string;
}) {
  const meta = CATEGORY_META[item.category];
  const priMeta = PRIORITY_META[item.priority];

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 transition ${
      checked ? "border-border/40 bg-surface/30 opacity-60" : "border-border/60 bg-surface hover:border-brand/20"
    }`}>
      <button
        onClick={onToggle}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
          checked ? "border-brand bg-brand text-brand-foreground" : "border-border bg-background hover:border-brand"
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
          <span className={`text-[10px] font-medium ${priMeta.cls}`}>
            {item.priority === "high" && <Flame className="mr-0.5 inline h-3 w-3" />}
            {priMeta.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />{item.hours}h
          </span>
        </div>
        <p className={`text-sm ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {item.text}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Application Strategy Card
// ─────────────────────────────────────────────
function AppStrategyCard({
  strategy, open, onToggle,
}: {
  strategy: RoadmapData["applicationStrategy"]; open: boolean; onToggle: () => void;
}) {
  if (!strategy) return null;
  const NOTE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
    "도전권": { bg: "#ef444410", text: "#ef4444", border: "#ef444430" },
    "적정권": { bg: "#f59e0b10", text: "#f59e0b", border: "#f59e0b30" },
    "안정권": { bg: "#10b98110", text: "#10b981", border: "#10b98130" },
  };

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <University className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-bold text-foreground">수시/정시 지원 전략</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-amber-400/20 px-5 pb-5 pt-4 space-y-6">
          {/* 수시 전형 적합도 */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wide">수시 전형 적합도 분석</h4>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface/80">
                    <th className="border-b border-r border-border/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">전형</th>
                    <th className="border-b border-r border-border/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-24">적합도</th>
                    <th className="border-b border-border/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">선택 이유</th>
                  </tr>
                </thead>
                <tbody>
                  {(strategy.suSi ?? []).map((s, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-b-0">
                      <td className="border-r border-border/30 px-3 py-2.5 text-xs font-semibold text-foreground">{s.type}</td>
                      <td className="border-r border-border/30 px-3 py-2.5 text-sm">{s.suitability}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 추천 지원 조합 */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wide">추천 지원 조합 (수시 6장)</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {(strategy.recommendedApps ?? []).map((app, i) => {
                const noteColor = NOTE_COLOR[app.note] ?? NOTE_COLOR["적정권"];
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border p-3"
                    style={{ borderColor: noteColor.border, background: noteColor.bg }}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: noteColor.text, color: "#fff" }}
                    >
                      {app.card}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{app.university}</p>
                      <p className="text-xs text-muted-foreground">{app.major} · {app.type}</p>
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ color: noteColor.text, background: noteColor.bg, border: `1px solid ${noteColor.border}` }}
                      >
                        {app.note}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 정시 전략 */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-bold text-foreground">정시 전략</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{strategy.jungSiStrategy}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function Section({
  icon: Icon, title, color, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-sm font-bold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function StrategyItem({ label, value, color }: { label: string; value?: string; color: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] font-semibold" style={{ color }}>{label}: </span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  );
}
