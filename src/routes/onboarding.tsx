import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadProfile, saveProfile, type StudentProfile } from "@/lib/profile";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "10분 진단 — NAVI" },
      { name: "description", content: "내신·모의고사·관심분야 입력으로 AI 맞춤 로드맵 생성" },
    ],
  }),
  component: Onboarding,
});

const GRADES: StudentProfile["grade"][] = ["중2", "중3", "고1", "고2", "고3", "N수"];
const TRACKS: StudentProfile["trackType"][] = ["이과", "문과", "예체능", "미정"];
const INTERESTS = [
  "공학", "의약", "자연과학", "경영/경제", "인문/사회", "교육", "예술/디자인",
  "IT/SW", "법/행정", "미디어", "체육", "농생명",
];

function Onboarding() {
  const navigate = useNavigate();
  const [p, setP] = useState<StudentProfile>({
    name: "",
    grade: "고1",
    region: "",
    internalGrade: "",
    mockGrade: "",
    interests: [],
    targetUniversity: "",
    targetMajor: "",
    trackType: "미정",
    notes: "",
  });

  useEffect(() => {
    const existing = loadProfile();
    if (existing) setP(existing);
  }, []);

  function toggleInterest(t: string) {
    setP((prev) => ({
      ...prev,
      interests: prev.interests.includes(t)
        ? prev.interests.filter((x) => x !== t)
        : [...prev.interests, t],
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.name.trim()) return;
    saveProfile(p);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 md:py-16">
      <div className="mb-8 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold tracking-tight">NAVI</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight">10분 진단</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        입력한 정보는 모두 기기에 저장되며, AI 코치 답변 품질을 위해 사용됩니다.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Field label="이름 / 닉네임">
          <input
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            className={inputCls}
            placeholder="홍길동"
            required
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
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

        <Field label="거주 지역">
          <input
            value={p.region}
            onChange={(e) => setP({ ...p, region: e.target.value })}
            className={inputCls}
            placeholder="예: 부산광역시 / 전북 익산"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="내신 평균 등급">
            <input
              value={p.internalGrade}
              onChange={(e) => setP({ ...p, internalGrade: e.target.value })}
              className={inputCls}
              placeholder="2.3"
              inputMode="decimal"
            />
          </Field>
          <Field label="모의고사 평균 등급">
            <input
              value={p.mockGrade}
              onChange={(e) => setP({ ...p, mockGrade: e.target.value })}
              className={inputCls}
              placeholder="3.0"
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="관심 분야 (복수 선택)">
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <Chip key={i} active={p.interests.includes(i)} onClick={() => toggleInterest(i)}>
                {i}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="목표 대학 (선택)">
            <input
              value={p.targetUniversity}
              onChange={(e) => setP({ ...p, targetUniversity: e.target.value })}
              className={inputCls}
              placeholder="예: 부산대"
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

        <Field label="자유 메모 (코치에게 알리고 싶은 내용)">
          <textarea
            value={p.notes}
            onChange={(e) => setP({ ...p, notes: e.target.value })}
            className={`${inputCls} min-h-[100px]`}
            placeholder="예: 수학을 어려워해요. 동아리는 과학탐구반."
          />
        </Field>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-6 py-4 text-base font-semibold text-brand-foreground shadow-glow transition hover:scale-[1.01]"
        >
          진단 완료하고 로드맵 보기 <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-brand focus:bg-surface-elevated";

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
