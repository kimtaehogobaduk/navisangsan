export type RoadmapSubTask = {
  text: string;
  detail: string;
  resource?: string;
};

export type RoadmapTask = {
  id: string;
  title: string;
  detail: string;
  category: "academics" | "exam" | "records" | "essay" | "activity" | "mental";
  week: number;
  priority: "high" | "medium" | "low";
  estimatedHours: number;
  subtasks: RoadmapSubTask[];
};

export type RoadmapWeek = {
  weekNum: number;
  focus: string;
  tasks: RoadmapTask[];
};

export type RoadmapMonth = {
  title: string;
  focus: string;
  theme: string;
  milestones: string[];
  weeks: RoadmapWeek[];
};

export const CATEGORY_META: Record<
  RoadmapTask["category"],
  { label: string; color: string; bg: string }
> = {
  academics: { label: "내신", color: "#6366f1", bg: "#6366f120" },
  exam: { label: "수능", color: "#8b5cf6", bg: "#8b5cf620" },
  records: { label: "생기부", color: "#10b981", bg: "#10b98120" },
  essay: { label: "자소서·면접", color: "#f59e0b", bg: "#f59e0b20" },
  activity: { label: "과외활동", color: "#06b6d4", bg: "#06b6d420" },
  mental: { label: "멘탈·건강", color: "#ec4899", bg: "#ec489920" },
};

const ROADMAP_KEY = "navi.roadmap.v2";
const DONE_KEY = "navi.roadmap.done.v2";

export function loadRoadmap(): RoadmapMonth[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROADMAP_KEY);
    return raw ? (JSON.parse(raw) as RoadmapMonth[]) : [];
  } catch {
    return [];
  }
}

export function saveRoadmap(months: RoadmapMonth[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROADMAP_KEY, JSON.stringify(months));
}

export function loadDone(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DONE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDone(done: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
}
