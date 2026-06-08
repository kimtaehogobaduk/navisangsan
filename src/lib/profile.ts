export type StudentProfile = {
  name: string;
  grade: "중2" | "중3" | "고1" | "고2" | "고3" | "N수";
  region: string;
  internalGrade: string; // 내신 등급, e.g. "2.3"
  mockGrade: string; // 모의고사 평균 등급
  interests: string[]; // 관심 분야
  targetUniversity: string;
  targetMajor: string;
  trackType: "이과" | "문과" | "예체능" | "미정";
  notes?: string;
};

const KEY = "navi.studentProfile.v1";

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

export function profileSummary(p: StudentProfile): string {
  return [
    `이름: ${p.name}`,
    `학년: ${p.grade} (${p.trackType})`,
    `지역: ${p.region}`,
    `내신 평균: ${p.internalGrade}등급`,
    `모의고사 평균: ${p.mockGrade}등급`,
    `관심 분야: ${p.interests.join(", ") || "미정"}`,
    `목표: ${p.targetUniversity || "미정"} ${p.targetMajor || ""}`.trim(),
    p.notes ? `메모: ${p.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
