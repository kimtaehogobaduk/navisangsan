export type SubjectGrade = {
  grade: string;
  percentile?: string;
};

export type MockSubjectGrades = {
  korean?: SubjectGrade;
  math?: SubjectGrade;
  english?: SubjectGrade;
  society?: SubjectGrade;
  science?: SubjectGrade;
  history?: SubjectGrade;
};

export type InternalYearRecord = {
  year: "1학년" | "2학년" | "3학년";
  korean?: string;
  math?: string;
  english?: string;
  society?: string;
  science?: string;
  history?: string;
  koreanHours?: string;
  mathHours?: string;
  englishHours?: string;
  societyHours?: string;
  scienceHours?: string;
  historyHours?: string;
  electives?: { subject: string; grade: string }[];
};

export type ElectiveSubjectEntry = {
  subject: string;
  grade?: string;
};

export type StudentProfile = {
  name: string;
  grade: "중2" | "중3" | "고1" | "고2" | "고3" | "N수";
  school: string;
  mockGrades: MockSubjectGrades;
  internalYears?: InternalYearRecord[];
  electiveSubjects?: ElectiveSubjectEntry[];
  interests: string[];
  customInterest?: string;
  targetUniversity: string;
  targetMajor: string;
  trackType: "이과" | "문과" | "예체능" | "미정";
  notes?: string;
};

const KEY = "navi.studentProfile.v2";

export function loadProfile(): StudentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudentProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: StudentProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

const MOCK_LABEL_MAP: Record<string, string> = {
  korean: "국어", math: "수학", english: "영어",
  society: "사회", science: "과학", history: "한국사",
};

export function profileSummary(p: StudentProfile): string {
  const lines: string[] = [
    `이름: ${p.name}`,
    `학년: ${p.grade} (${p.trackType})`,
    p.school ? `학교: ${p.school}` : "",
  ];

  const mockEntries = Object.entries(p.mockGrades ?? {});
  if (mockEntries.length) {
    const mockLine = mockEntries
      .filter(([, v]) => v?.grade)
      .map(([k, v]) => `${MOCK_LABEL_MAP[k]} ${v!.grade}등급${v!.percentile ? `(${v!.percentile}%)` : ""}`)
      .join(" | ");
    if (mockLine) lines.push(`모의고사: ${mockLine}`);
  }

  if (p.internalYears?.length) {
    for (const yr of p.internalYears) {
      const subs = [
        yr.korean && `국어 ${yr.korean}${yr.koreanHours ? `(${yr.koreanHours}u)` : ""}`,
        yr.math && `수학 ${yr.math}${yr.mathHours ? `(${yr.mathHours}u)` : ""}`,
        yr.english && `영어 ${yr.english}${yr.englishHours ? `(${yr.englishHours}u)` : ""}`,
        yr.society && `사회 ${yr.society}${yr.societyHours ? `(${yr.societyHours}u)` : ""}`,
        yr.science && `과학 ${yr.science}${yr.scienceHours ? `(${yr.scienceHours}u)` : ""}`,
        yr.history && `한국사 ${yr.history}${yr.historyHours ? `(${yr.historyHours}u)` : ""}`,
      ].filter(Boolean);
      lines.push(`내신 ${yr.year}: ${subs.join(" / ")}`);
    }
  }

  if (p.electiveSubjects?.length) {
    lines.push(`선택과목: ${p.electiveSubjects.map(e => e.grade ? `${e.subject}(${e.grade})` : e.subject).join(", ")}`);
  }

  const allInterests = [...(p.interests ?? []), ...(p.customInterest ? [p.customInterest] : [])];
  if (allInterests.length) lines.push(`관심 분야: ${allInterests.join(", ")}`);
  if (p.targetUniversity || p.targetMajor) lines.push(`목표: ${p.targetUniversity || ""} ${p.targetMajor || ""}`.trim());
  if (p.notes) lines.push(`메모: ${p.notes}`);

  return lines.filter(Boolean).join("\n");
}
