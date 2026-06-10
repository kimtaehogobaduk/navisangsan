import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  loadProfile, saveProfile,
  type StudentProfile, type MockSubjectGrades, type InternalYearRecord, type ElectiveSubjectEntry,
} from "@/lib/profile";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Plus, X, Info } from "lucide-react";
import { consumeProfileRequired } from "@/lib/require-profile";
import { researchSchoolFn } from "@/lib/school.functions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "10분 진단 — NAVI" },
      { name: "description", content: "내 성적과 관심분야 입력으로 AI 맞춤 로드맵 생성" },
    ],
  }),
  component: Onboarding,
});

const GRADES: StudentProfile["grade"][] = ["중2", "중3", "고1", "고2", "고3", "N수"];
const TRACKS: StudentProfile["trackType"][] = ["이과", "문과", "예체능", "미정"];
const GRADE_NUMS = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
// 고2 이하: 2022 개정 교육과정 5등급제 (A~E = 1~5)
const INTERNAL_GRADE_5 = ["", "1", "2", "3", "4", "5"];
const INTERNAL_GRADE_9 = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const FIVE_TIER_GRADES: StudentProfile["grade"][] = ["고1", "고2"];

const HIGH_GRADES: StudentProfile["grade"][] = ["고1", "고2", "고3", "N수"];
const INTERNAL_YEARS_MAP: Record<string, ("1학년" | "2학년" | "3학년")[]> = {
  "고1": ["1학년"],
  "고2": ["1학년", "2학년"],
  "고3": ["1학년", "2학년", "3학년"],
  "N수": ["1학년", "2학년", "3학년"],
};

const CORE_SUBJECTS = [
  { key: "korean", label: "국어" },
  { key: "math", label: "수학" },
  { key: "english", label: "영어" },
  { key: "society", label: "사회" },
  { key: "science", label: "과학" },
  { key: "history", label: "한국사" },
] as const;

const INTERESTS_PRESET = [
  "공학/기술", "의약/바이오", "자연과학", "경영/경제",
  "인문/철학", "사회/법정치", "교육/사범", "예술/디자인",
  "IT/컴퓨터", "미디어/언론",
];

const ELECTIVE_CATEGORIES = [
  {
    category: "수학",
    subjects: ["미적분", "확률과통계", "기하", "수학과제탐구", "고급수학I", "고급수학II", "선형대수학(기초)", "인공지능수학"],
  },
  {
    category: "물리학",
    subjects: ["물리학I", "물리학II", "고급물리학"],
  },
  {
    category: "화학",
    subjects: ["화학I", "화학II", "고급화학"],
  },
  {
    category: "생명과학",
    subjects: ["생명과학I", "생명과학II", "고급생명과학"],
  },
  {
    category: "지구과학",
    subjects: ["지구과학I", "지구과학II", "고급지구과학"],
  },
  {
    category: "과학(탐구/통합)",
    subjects: ["과학과제연구", "융합과학탐구", "기후변화와환경생태"],
  },
  {
    category: "사회",
    subjects: ["사회문화", "생활과윤리", "윤리와사상", "한국지리", "세계지리", "동아시아사", "세계사", "경제", "정치와법", "여행지리", "사회문제탐구", "금융과경제생활"],
  },
  {
    category: "국어",
    subjects: ["화법과언어", "독서와작문", "주제탐구독서", "문학과영상", "매체의사소통"],
  },
  {
    category: "영어",
    subjects: ["고급영어I", "고급영어II", "심화영어I", "심화영어II", "영어권문화", "진로영어", "실용영어", "영미문학읽기"],
  },
  {
    category: "정보/AI",
    subjects: ["정보", "인공지능기초", "데이터과학", "소프트웨어와생활"],
  },
  {
    category: "제2외국어",
    subjects: ["일본어I", "일본어II", "중국어I", "중국어II", "독일어I", "독일어II", "프랑스어I", "프랑스어II", "스페인어I", "스페인어II", "아랍어I", "아랍어II", "러시아어I", "러시아어II"],
  },
  {
    category: "예체능",
    subjects: ["체육", "운동과건강", "스포츠생활I", "스포츠생활II", "음악", "음악연주와창작", "미술", "미술창작", "연극", "영화"],
  },
  {
    category: "기타",
    subjects: ["한문I", "한문II", "철학", "논리학", "심리학", "교육학", "보건", "진로와직업"],
  },
];

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface-elevated";
const selectCls =
  "rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand";

function makeEmptyProfile(): StudentProfile {
  return {
    name: "",
    grade: "고2",
    school: "",
    mockGrades: {},
    internalYears: [],
    electiveSubjects: [],
    interests: [],
    customInterest: "",
    targetUniversity: "",
    targetMajor: "",
    trackType: "미정",
    notes: "",
  };
}

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<StudentProfile>(makeEmptyProfile());
  const [customInterestInput, setCustomInterestInput] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [requiredFrom, setRequiredFrom] = useState<string | null>(null);

  const isHighSchool = HIGH_GRADES.includes(p.grade);
  const internalYearsAvailable = INTERNAL_YEARS_MAP[p.grade] ?? [];
  const totalSteps = isHighSchool ? 5 : 4;

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      setP({ ...makeEmptyProfile(), ...existing });
      setCustomInterestInput(existing.customInterest ?? "");
    }
    setRequiredFrom(consumeProfileRequired());
  }, []);


  function setMockGrade(key: keyof MockSubjectGrades, field: "grade" | "percentile", val: string) {
    setP((prev) => ({
      ...prev,
      mockGrades: {
        ...prev.mockGrades,
        [key]: { ...(prev.mockGrades?.[key] ?? {}), [field]: val },
      },
    }));
  }

  function setInternalGrade(yearLabel: InternalYearRecord["year"], key: string, val: string) {
    setP((prev) => {
      const existing = prev.internalYears ?? [];
      const idx = existing.findIndex((y) => y.year === yearLabel);
      if (idx === -1) {
        return { ...prev, internalYears: [...existing, { year: yearLabel, [key]: val }] };
      }
      const updated = [...existing];
      updated[idx] = { ...updated[idx], [key]: val };
      return { ...prev, internalYears: updated };
    });
  }

  function getInternalGrade(yearLabel: InternalYearRecord["year"], key: string): string {
    return (p.internalYears?.find((y) => y.year === yearLabel) as Record<string, string> | undefined)?.[key] ?? "";
  }

  function toggleElective(subject: string) {
    setP((prev) => {
      const curr = prev.electiveSubjects ?? [];
      if (curr.find((e) => e.subject === subject)) {
        return { ...prev, electiveSubjects: curr.filter((e) => e.subject !== subject) };
      }
      return { ...prev, electiveSubjects: [...curr, { subject, grade: "" }] };
    });
  }

  function setElectiveGrade(subject: string, grade: string) {
    setP((prev) => ({
      ...prev,
      electiveSubjects: (prev.electiveSubjects ?? []).map((e) =>
        e.subject === subject ? { ...e, grade } : e
      ),
    }));
  }

  function isElectiveSelected(subject: string) {
    return !!(p.electiveSubjects ?? []).find((e) => e.subject === subject);
  }

  function toggleInterest(interest: string) {
    setP((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    saveProfile({ ...p, customInterest: customInterestInput });
    if (p.school?.trim()) {
      researchSchoolFn({ data: { school: p.school.trim() } }).catch(() => {});
    }
    navigate({ to: "/dashboard" });
  }

  function nextStep() {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const stepLabels = isHighSchool
    ? ["기본 정보", "모의고사", "내신", "선택과목", "관심분야·목표"]
    : ["기본 정보", "모의고사", "선택과목", "관심분야·목표"];

  const displayStep = step;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-14">
      <div className="mb-8 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold tracking-tight">NAVI</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">10분 진단</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        입력한 정보는 기기에만 저장되며, AI 코치 답변 품질을 위해 사용됩니다.
      </p>

      {requiredFrom && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="font-semibold text-foreground">
              <span className="text-brand">{requiredFrom}</span> 기능은 진단이 끝나면 바로 열려요
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              개인화된 결과를 위해 10분 진단을 먼저 완료해 주세요. 진단 후 자동으로 모든 기능이 활성화됩니다.
            </p>
          </div>
        </div>
      )}


      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-1">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
              i < displayStep
                ? "bg-brand text-brand-foreground"
                : i === displayStep
                ? "bg-brand/20 border border-brand text-brand"
                : "bg-surface border border-border text-muted-foreground"
            }`}>
              {i < displayStep ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`hidden sm:block text-xs truncate ${i === displayStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < stepLabels.length - 1 && (
              <div className={`h-px flex-1 mx-1 ${i < displayStep ? "bg-brand/60" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-8">
        {/* ── STEP 0: 기본 정보 ── */}
        {step === 0 && (
          <div className="space-y-6">
            <SectionTitle>기본 정보</SectionTitle>

            <Field label="이름 / 닉네임 *">
              <input
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
                className={inputCls}
                placeholder="홍길동"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="학년">
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((g) => (
                    <Chip key={g} active={p.grade === g} onClick={() => setP({ ...p, grade: g })}>
                      {g}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="계열">
                <div className="flex flex-wrap gap-2">
                  {TRACKS.map((t) => (
                    <Chip key={t} active={p.trackType === t} onClick={() => setP({ ...p, trackType: t })}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="학교">
              <input
                value={p.school}
                onChange={(e) => setP({ ...p, school: e.target.value })}
                className={inputCls}
                placeholder="예: 부산과학고등학교"
              />
            </Field>
          </div>
        )}

        {/* ── STEP 1: 모의고사 성적 ── */}
        {step === 1 && (
          <div className="space-y-6">
            <SectionTitle>모의고사 성적</SectionTitle>
            <p className="text-xs text-muted-foreground -mt-4">
              등급은 1(최고)~9(최저). 백분위는 선택 입력입니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground w-20">과목</th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground">등급</th>
                    <th className="pb-3 text-left text-xs font-medium text-muted-foreground pl-3">백분위 (선택)</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {CORE_SUBJECTS.map(({ key, label }) => (
                    <tr key={key} className="border-t border-border/40">
                      <td className="py-3 text-sm font-medium text-foreground">{label}</td>
                      <td className="py-3 pr-3">
                        <select
                          value={p.mockGrades?.[key]?.grade ?? ""}
                          onChange={(e) => setMockGrade(key, "grade", e.target.value)}
                          className={`${selectCls} w-20`}
                        >
                          {GRADE_NUMS.map((g) => (
                            <option key={g} value={g}>{g ? `${g}등급` : "미입력"}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pl-3">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={p.mockGrades?.[key]?.percentile ?? ""}
                          onChange={(e) => setMockGrade(key, "percentile", e.target.value)}
                          className={`${selectCls} w-24`}
                          placeholder="예: 12"
                          disabled={!p.mockGrades?.[key]?.grade}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STEP 2: 내신 성적 (고1+만) ── */}
        {step === 2 && isHighSchool && (
          <div className="space-y-8">
            <SectionTitle>내신 성적</SectionTitle>
            <p className="text-xs text-muted-foreground -mt-6">
              학년별 과목 등급을 입력해주세요.
              {FIVE_TIER_GRADES.includes(p.grade as typeof FIVE_TIER_GRADES[number])
                ? " (2022 개정 교육과정 · 5등급제 적용)"
                : " (1~9등급, 미입력 가능)"}
            </p>
            {internalYearsAvailable.map((yearLabel) => {
              const gradeNums = FIVE_TIER_GRADES.includes(p.grade as typeof FIVE_TIER_GRADES[number])
                ? INTERNAL_GRADE_5
                : INTERNAL_GRADE_9;
              return (
              <div key={yearLabel} className="rounded-2xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{yearLabel}</h3>
                  {gradeNums === INTERNAL_GRADE_5 && (
                    <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-400">5등급제</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {CORE_SUBJECTS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <select
                        value={getInternalGrade(yearLabel, key)}
                        onChange={(e) => setInternalGrade(yearLabel, key, e.target.value)}
                        className={`${selectCls} w-full`}
                      >
                        {gradeNums.map((g) => (
                          <option key={g} value={g}>{g ? `${g}등급` : "-"}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* ── STEP 3: 선택과목 ── */}
        {((step === 3 && isHighSchool) || (step === 2 && !isHighSchool)) && (
          <div className="space-y-5">
            <SectionTitle>선택과목</SectionTitle>
            <p className="text-xs text-muted-foreground -mt-4">
              수강 중이거나 수강 예정인 과목을 선택하고 등급을 입력해주세요.
            </p>

            {ELECTIVE_CATEGORIES.map(({ category, subjects }) => (
              <div key={category} className="rounded-2xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCat(category)}
                  className="flex w-full items-center justify-between bg-surface px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-elevated transition"
                >
                  <span>{category}</span>
                  <span className="text-xs text-muted-foreground">
                    {subjects.filter(isElectiveSelected).length > 0
                      ? `${subjects.filter(isElectiveSelected).length}개 선택`
                      : expandedCats.has(category) ? "▲" : "▼"}
                  </span>
                </button>

                {(expandedCats.has(category) || subjects.some(isElectiveSelected)) && (
                  <div className="border-t border-border bg-background p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((subj) => (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => toggleElective(subj)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            isElectiveSelected(subj)
                              ? "border-brand bg-brand text-brand-foreground shadow-glow"
                              : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"
                          }`}
                        >
                          {subj}
                        </button>
                      ))}
                    </div>
                    {subjects.filter(isElectiveSelected).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-muted-foreground">선택 과목 등급 입력 (선택 사항)</p>
                        {subjects.filter(isElectiveSelected).map((subj) => (
                          <div key={subj} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-foreground w-32 shrink-0">{subj}</span>
                            <select
                              value={p.electiveSubjects?.find((e) => e.subject === subj)?.grade ?? ""}
                              onChange={(e) => setElectiveGrade(subj, e.target.value)}
                              className={`${selectCls} w-24`}
                            >
                              {GRADE_NUMS.map((g) => (
                                <option key={g} value={g}>{g ? `${g}등급` : "미입력"}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Selected summary */}
            {(p.electiveSubjects ?? []).length > 0 && (
              <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
                <p className="mb-2 text-xs font-medium text-brand">선택된 과목 ({p.electiveSubjects!.length}개)</p>
                <div className="flex flex-wrap gap-2">
                  {p.electiveSubjects!.map((e) => (
                    <span
                      key={e.subject}
                      className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-1 text-xs text-brand"
                    >
                      {e.subject}{e.grade ? ` ${e.grade}등급` : ""}
                      <button type="button" onClick={() => toggleElective(e.subject)} className="ml-1 opacity-60 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: 관심분야 + 목표 ── */}
        {((step === 4 && isHighSchool) || (step === 3 && !isHighSchool)) && (
          <div className="space-y-6">
            <SectionTitle>관심분야 · 목표</SectionTitle>

            <Field label="관심 분야 (복수 선택)">
              <div className="flex flex-wrap gap-2">
                {INTERESTS_PRESET.map((i) => (
                  <Chip key={i} active={p.interests.includes(i)} onClick={() => toggleInterest(i)}>
                    {i}
                  </Chip>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">기타:</span>
                <input
                  value={customInterestInput}
                  onChange={(e) => setCustomInterestInput(e.target.value)}
                  className={`${inputCls} py-2`}
                  placeholder="직접 입력 (예: 항공우주, 환경공학 등)"
                />
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="목표 대학 (선택)">
                <input
                  value={p.targetUniversity}
                  onChange={(e) => setP({ ...p, targetUniversity: e.target.value })}
                  className={inputCls}
                  placeholder="예: 서울대학교"
                />
              </Field>
              <Field label="목표 학과 (선택)">
                <input
                  value={p.targetMajor}
                  onChange={(e) => setP({ ...p, targetMajor: e.target.value })}
                  className={inputCls}
                  placeholder="예: 컴퓨터공학과"
                />
              </Field>
            </div>

            <Field label="자유 메모 (AI 코치에게 알릴 내용)">
              <textarea
                value={p.notes}
                onChange={(e) => setP({ ...p, notes: e.target.value })}
                className={`${inputCls} min-h-[90px]`}
                placeholder="예: 수학은 자신 있는데 국어가 걱정돼요. 과학 동아리 활동 중입니다."
              />
            </Field>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition hover:bg-surface-elevated"
            >
              <ArrowLeft className="h-4 w-4" />
              이전
            </button>
          )}

          {step < totalSteps - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={step === 0 && !p.name.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01] disabled:opacity-40"
            >
              다음
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01]"
            >
              진단 완료 — 로드맵 보기
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-brand bg-brand text-brand-foreground shadow-glow"
          : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
