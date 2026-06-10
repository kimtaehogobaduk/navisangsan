import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  BookOpen,
  Users,
  Brain,
  LogOut,
} from "lucide-react";
import {
  loadTrainingDocs,
  saveTrainingDocs,
  TRAINING_CATEGORIES,
  type TrainingDoc,
} from "@/lib/training";
import { queueYoutubeJobsFn, listTrainingJobsFn } from "@/lib/training-jobs.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "관리자 패널 — NAVI" }] }),
  component: AdminPage,
});

type AdminTab = "training" | "youtube" | "stats";

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("training");
  const [docs, setDocs] = useState<TrainingDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: TRAINING_CATEGORIES[0], title: "", content: "" });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("navi.admin") !== "true") {
      navigate({ to: "/login" });
      return;
    }
    setDocs(loadTrainingDocs());
  }, [navigate]);

  function logout() {
    sessionStorage.removeItem("navi.admin");
    navigate({ to: "/login" });
  }

  function openAdd() {
    setEditingId(null);
    setForm({ category: TRAINING_CATEGORIES[0], title: "", content: "" });
    setShowForm(true);
  }

  function openEdit(doc: TrainingDoc) {
    setEditingId(doc.id);
    setForm({ category: doc.category, title: doc.title, content: doc.content });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    let updated: TrainingDoc[];
    if (editingId) {
      updated = docs.map((d) =>
        d.id === editingId ? { ...d, ...form } : d,
      );
    } else {
      const newDoc: TrainingDoc = {
        id: `doc-${Date.now()}`,
        ...form,
        createdAt: new Date().toISOString(),
      };
      updated = [...docs, newDoc];
    }
    setDocs(updated);
    saveTrainingDocs(updated);
    setShowForm(false);
    setEditingId(null);
  }

  function handleDelete(id: string) {
    const updated = docs.filter((d) => d.id !== id);
    setDocs(updated);
    saveTrainingDocs(updated);
  }

  const groupedDocs = TRAINING_CATEGORIES.reduce<Record<string, TrainingDoc[]>>((acc, cat) => {
    acc[cat] = docs.filter((d) => d.category === cat);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500 text-black">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">NAVI 관리자</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold">관리자 패널</h1>
            <p className="text-sm text-muted-foreground">
              AI 학습 자료를 관리하고 서비스 현황을 확인하세요
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
            총 {docs.length}개 자료
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {(["training", "stats"] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-amber-500 text-black"
                  : "border border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "training" ? (
                <>
                  <Brain className="h-4 w-4" />
                  AI 학습 자료
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  서비스 현황
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "training" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold">
                    <Brain className="h-5 w-5 text-amber-400" />
                    AI 학습 자료 관리
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    여기에 입력한 자료는 AI 코치와 로드맵 생성 시 참고 지식으로 활용됩니다.
                  </p>
                </div>
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
                >
                  <Plus className="h-4 w-4" />
                  자료 추가
                </button>
              </div>

              {showForm && (
                <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-amber-300">
                      {editingId ? "자료 수정" : "새 자료 추가"}
                    </h3>
                    <button onClick={() => setShowForm(false)}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">카테고리</label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                      >
                        {TRAINING_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">제목</label>
                      <input
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="예: 연세대 의예과 세특 키워드"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      내용{" "}
                      <span className="text-[10px]">(AI가 이 내용을 그대로 학습합니다)</span>
                    </label>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="예: 연세대 의예과는 생명과학, 화학 세특에서 실험 설계 능력과 의학적 탐구심을 강조해야 함. 특히 윤리적 판단력 관련 내용을 포함하면 유리..."
                      rows={5}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowForm(false)}
                      className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
                    >
                      <Save className="h-4 w-4" />
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>

            {docs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">아직 등록된 학습 자료가 없습니다.</p>
                <button
                  onClick={openAdd}
                  className="mt-3 text-sm text-amber-400 hover:underline"
                >
                  첫 번째 자료 추가하기 →
                </button>
              </div>
            ) : (
              TRAINING_CATEGORIES.filter((c) => groupedDocs[c]?.length > 0).map((cat) => (
                <div key={cat} className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {cat}
                    <span className="text-xs font-normal">({groupedDocs[cat].length})</span>
                  </h3>
                  {groupedDocs[cat].map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-2xl border border-border bg-surface p-4 transition hover:border-amber-500/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{doc.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {doc.content}
                          </div>
                          <div className="mt-1.5 text-[10px] text-muted-foreground/60">
                            등록: {new Date(doc.createdAt).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openEdit(doc)}
                            className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:border-amber-400 hover:text-amber-400"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="rounded-lg border border-border p-1.5 text-muted-foreground transition hover:border-red-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "등록된 학습 자료", value: docs.length, unit: "개", color: "text-amber-400" },
                { label: "AI 학습 카테고리", value: TRAINING_CATEGORIES.length, unit: "개", color: "text-blue-400" },
                {
                  label: "마지막 업데이트",
                  value: docs.length
                    ? new Date(
                        Math.max(...docs.map((d) => new Date(d.createdAt).getTime())),
                      ).toLocaleDateString("ko-KR")
                    : "없음",
                  unit: "",
                  color: "text-green-400",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                  <div className={`mt-2 text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      {stat.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="mb-4 text-sm font-bold">카테고리별 자료 현황</h3>
              <div className="space-y-3">
                {TRAINING_CATEGORIES.map((cat) => {
                  const count = groupedDocs[cat]?.length ?? 0;
                  const pct = docs.length ? (count / docs.length) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">{cat}</span>
                        <span className="font-medium">{count}개</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
