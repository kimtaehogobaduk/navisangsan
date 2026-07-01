export type CheckItem = {
  id: string;
  category: "study" | "exam" | "records" | "essay" | "activity" | "mental";
  text: string;
  week: 1 | 2 | 3 | 4;
  priority: "high" | "medium" | "low";
  hours: number;
  tips?: string[];
};

export type StudyStrategy = {
  korean: string;
  math: string;
  english: string;
  scienceOrSociety: string;
  weakSubject: string;
  weeklyHours: number;
};

export type ExamStrategy = {
  focus: string;
  mockExam: string;
  practiceType: string;
};

export type RecordStrategy = {
  seukuk: string[];
  activity: string;
  careerActivity: string;
  keyKeyword: string;
};

export type MonthPlan = {
  phase: "단기" | "중기" | "장기";
  monthLabel: string;
  theme: string;
  keyEvents: string[];
  studyStrategy: StudyStrategy;
  examStrategy: ExamStrategy;
  recordStrategy: RecordStrategy;
  essayStrategy: string;
  mentalStrategy: string;
  priorities: string[];
  checkItems: CheckItem[];
};

export type RoadmapOverview = {
  diagnosis: string;
  strengths: string[];
  weaknesses: string[];
  coreStrategy: string;
  applicationRatio: string;
};

export type AppStrategyEntry = {
  type: string;
  suitability: string;
  reason: string;
};

export type RecommendedApp = {
  card: number;
  university: string;
  major: string;
  type: string;
  note: string;
};

export type ApplicationStrategy = {
  suSi: AppStrategyEntry[];
  recommendedApps: RecommendedApp[];
  jungSiStrategy: string;
};

export type RoadmapData = {
  overview: RoadmapOverview;
  months: MonthPlan[];
  applicationStrategy: ApplicationStrategy;
};

export const CATEGORY_META: Record<
  CheckItem["category"],
  { label: string; color: string; bg: string }
> = {
  study:   { label: "학습",   color: "#6366f1", bg: "#6366f120" },
  exam:    { label: "수능",   color: "#8b5cf6", bg: "#8b5cf620" },
  records: { label: "생기부", color: "#10b981", bg: "#10b98120" },
  essay:   { label: "자소서", color: "#f59e0b", bg: "#f59e0b20" },
  activity:{ label: "활동",   color: "#06b6d4", bg: "#06b6d420" },
  mental:  { label: "멘탈",   color: "#ec4899", bg: "#ec489920" },
};

// USER_DATA_PREFIX(navi.user.*) 로 저장해 cloud-sync 로 자동 동기화
const ROADMAP_KEY = "navi.user.roadmap.v4";
const DONE_KEY    = "navi.user.roadmap.done.v4";
const LEGACY_ROADMAP = "navi.roadmap.v4";
const LEGACY_DONE = "navi.roadmap.done.v4";

function migrate(key: string, legacy: string): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(key);
  if (v) return v;
  const old = localStorage.getItem(legacy);
  if (old) { localStorage.setItem(key, old); localStorage.removeItem(legacy); return old; }
  return null;
}

export function loadRoadmap(): RoadmapData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = migrate(ROADMAP_KEY, LEGACY_ROADMAP);
    return raw ? (JSON.parse(raw) as RoadmapData) : null;
  } catch { return null; }
}

export function saveRoadmap(data: RoadmapData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROADMAP_KEY, JSON.stringify(data));
}

export function clearRoadmap() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROADMAP_KEY);
  localStorage.removeItem(DONE_KEY);
  localStorage.removeItem(LEGACY_ROADMAP);
  localStorage.removeItem(LEGACY_DONE);
}

export function loadDone(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = migrate(DONE_KEY, LEGACY_DONE);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function saveDone(done: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
}

// Legacy compat (used by MindMap etc if still referenced)
export type RoadmapTask = CheckItem & { title: string; detail: string; estimatedHours: number; tips: string[] };
export type RoadmapMonth = {
  title: string; focus: string; studyFocus: string; recordFocus: string;
  theme: string; milestones: string[]; tasks: RoadmapTask[];
};
