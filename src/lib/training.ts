export type TrainingDoc = {
  id: string;
  category: string;
  title: string;
  content: string;
  createdAt: string;
};

const KEY = "navi.adminTraining.v1";

export function loadTrainingDocs(): TrainingDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrainingDoc[]) : [];
  } catch {
    return [];
  }
}

export function saveTrainingDocs(docs: TrainingDoc[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(docs));
}

export function getTrainingContext(): string {
  const docs = loadTrainingDocs();
  if (!docs.length) return "";
  return (
    "\n\n[관리자 추가 지식 자료 — 반드시 참고]\n" +
    docs.map((d) => `[${d.category}] ${d.title}\n${d.content}`).join("\n\n")
  );
}

export const TRAINING_CATEGORIES = [
  "입시 전략",
  "학교별 특성",
  "학과별 특성",
  "세특 키워드",
  "면접 전략",
  "공모전/활동",
  "기타",
];
