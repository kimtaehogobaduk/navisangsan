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
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { TRAINING_CATEGORIES, type TrainingDoc } from "@/lib/training";
import {
  queueYoutubeJobsFn,
  listTrainingJobsFn,
  listTrainingDocsFn,
  saveTrainingDocFn,
  deleteTrainingDocFn,
  cancelTrainingJobFn,
  deleteTrainingJobFn,
} from "@/lib/training-jobs.functions";
import { listAllUsersFn, getUserActivityDetailFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "관리자 패널 — NAVI" }] }),
  component: AdminPage,
});

const ADMIN_PASSCODE = "sangsanadmin";

type AdminTab = "training" | "youtube" | "members" | "stats";

function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("training");
  const [docs, setDocs] = useState<TrainingDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ category: TRAINING_CATEGORIES[0], title: "", content: "" });
  const [showForm, setShowForm] = useState(false);

  async function refreshDocs() {
    try {
      const res = await listTrainingDocsFn();
      const mapped: TrainingDoc[] = (res.docs ?? []).map((d: { id: string; category: string; title: string; content: string; created_at: string }) => ({
        id: d.id,
        category: d.category,
        title: d.title,
        content: d.content,
        createdAt: d.created_at,
      }));
      setDocs(mapped);
    } catch (e) {
      console.error("listTrainingDocs failed", e);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("navi.admin") !== "true") {
      navigate({ to: "/login" });
      return;
    }
    void refreshDocs();
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

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      await saveTrainingDocFn({
        data: {
          id: editingId && /^[0-9a-f-]{36}$/i.test(editingId) ? editingId : undefined,
          category: form.category,
          title: form.title,
          content: form.content,
        },
      });
      await refreshDocs();
    } catch (e) {
      console.error("saveTrainingDoc failed", e);
    }
    setShowForm(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    try {
      if (/^[0-9a-f-]{36}$/i.test(id)) {
        await deleteTrainingDocFn({ data: { id } });
      }
      await refreshDocs();
    } catch (e) {
      console.error("deleteTrainingDoc failed", e);
    }
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

        <div className="mb-6 flex gap-2 flex-wrap">
          {(["training", "youtube", "members", "stats"] as AdminTab[]).map((t) => (
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
              ) : t === "youtube" ? (
                <>
                  <BookOpen className="h-4 w-4" />
                  유튜브 일괄 학습
                </>
              ) : t === "members" ? (
                <>
                  <Users className="h-4 w-4" />
                  회원 관리
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

        {tab === "youtube" && <YoutubeTab />}
        {tab === "members" && <MembersTab />}

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

function YoutubeTab() {
  const [urls, setUrls] = useState("");
  const [category, setCategory] = useState(TRAINING_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [jobs, setJobs] = useState<{ id: string; url: string; status: string; error: string | null; created_at: string; doc_id?: string | null }[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  async function refresh() {
    try {
      const r = await listTrainingJobsFn();
      setJobs(r.jobs as typeof jobs);
      setSummary(r.summary);
    } catch { /* */ }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  async function submit() {
    const lines = urls
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) { setMsg("유효한 URL이 없습니다."); return; }
    if (lines.length > 10000) { setMsg("최대 10000개까지 한 번에 등록 가능합니다."); return; }
    setSubmitting(true); setMsg("");
    try {
      const r = await queueYoutubeJobsFn({ data: { urls: lines, category } });
      setMsg(`${r.queued}개 등록 완료 (스킵 ${r.skipped}). 백그라운드에서 자동 처리됩니다 (1분 단위).`);
      setUrls("");
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "등록 실패");
    } finally { setSubmitting(false); }
  }

  async function cancelJob(id: string) {
    setActingId(id);
    try {
      await cancelTrainingJobFn({ data: { id } });
      await refresh();
    } finally {
      setActingId(null);
    }
  }

  async function deleteJob(id: string) {
    setActingId(id);
    try {
      await deleteTrainingJobFn({ data: { id } });
      await refresh();
    } finally {
      setActingId(null);
    }
  }

  const dataJobs = jobs.filter((j) => j.status === "done");
  const queueJobs = jobs.filter((j) => j.status !== "done");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold">유튜브 일괄 학습</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          URL을 한 줄에 하나씩 (최대 10000개) 붙여넣으세요. 마크다운 링크/검색결과 형태여도 유튜브 링크만 추출해 큐에 넣습니다.
          창을 닫아도 백그라운드(서버 cron 1분 주기)에서 계속 처리됩니다.
        </p>
        <div className="mt-4 grid gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            {TRAINING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={8}
            placeholder="https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{msg}</span>
            <button onClick={submit} disabled={submitting}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
              {submitting ? "등록 중…" : "큐에 등록"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">처리 현황</h3>
          <div className="flex gap-3 text-xs">
            <span>대기 <b className="text-amber-400">{summary.pending ?? 0}</b></span>
            <span>처리중 <b className="text-blue-400">{summary.processing ?? 0}</b></span>
            <span>완료 <b className="text-green-400">{summary.done ?? 0}</b></span>
            <span>실패 <b className="text-red-400">{summary.failed ?? 0}</b></span>
          </div>
        </div>
        <div className="mt-3 space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold text-muted-foreground">작업 큐</div>
            <div className="max-h-64 overflow-auto space-y-1">
          {queueJobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border/50 px-3 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate flex-1">{j.url}</span>
                <div className="flex items-center gap-2">
                  <span className={
                    j.status === "done" ? "text-green-400" :
                    j.status === "failed" ? "text-red-400" :
                    j.status === "processing" ? "text-blue-400" : j.status === "cancelled" ? "text-muted-foreground" : "text-amber-400"
                  }>{j.status}</span>
                  {(j.status === "pending" || j.status === "processing" || j.status === "failed") && (
                    <button onClick={() => cancelJob(j.id)} disabled={actingId === j.id} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">취소</button>
                  )}
                  <button onClick={() => deleteJob(j.id)} disabled={actingId === j.id} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-red-400/90 disabled:opacity-50">삭제</button>
                </div>
              </div>
              {j.error && (
                <div className="mt-1 text-[11px] text-red-400/80 break-words">⚠ {j.error}</div>
              )}
            </div>
          ))}
          {!queueJobs.length && <p className="text-xs text-muted-foreground">대기/실패/처리중 작업이 없습니다.</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-green-400">데이터</div>
            <div className="max-h-64 overflow-auto space-y-1">
              {dataJobs.map((j) => (
                <div key={j.id} className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate flex-1">{j.url}</span>
                    <span className="text-green-400">완료</span>
                  </div>
                </div>
              ))}
              {!dataJobs.length && <p className="text-xs text-muted-foreground">완료되어 데이터로 적재된 항목이 없습니다.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type MemberRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  activity_count: number;
  last_active_at: string | null;
  activity_keys: string[];
};

function MembersTab() {
  const [users, setUsers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, { key: string; value: unknown; updated_at: string }[]>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await listAllUsersFn({ data: { passcode: ADMIN_PASSCODE } });
      const sorted = [...r.users].sort((a, b) => {
        const ta = a.last_active_at ?? a.last_sign_in_at ?? a.created_at;
        const tb = b.last_active_at ?? b.last_sign_in_at ?? b.created_at;
        return new Date(tb).getTime() - new Date(ta).getTime();
      });
      setUsers(sorted);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleDetail(userId: string) {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    if (detail[userId]) return;
    setDetailLoading(userId);
    try {
      const r = await getUserActivityDetailFn({ data: { passcode: ADMIN_PASSCODE, userId } });
      setDetail((d) => ({ ...d, [userId]: r.rows }));
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(null);
    }
  }

  const filtered = q
    ? users.filter((u) => u.email.toLowerCase().includes(q.toLowerCase()))
    : users;

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Users className="h-5 w-5 text-amber-400" />
              회원 목록 ({filtered.length})
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              모든 가입 회원과 활동 기록을 확인할 수 있어요. 행을 클릭하면 세부 내역이 펼쳐집니다.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "새로고침"}
          </button>
        </div>

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이메일로 검색…"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
        </div>

        {err && (
          <div className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {err}
          </div>
        )}
      </div>

      {loading && !users.length ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-sm text-muted-foreground">
          회원이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const isOpen = expanded === u.id;
            const rows = detail[u.id] ?? [];
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-surface">
                <button
                  onClick={() => toggleDetail(u.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-elevated"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{u.email || "(이메일 없음)"}</span>
                      {!u.email_confirmed_at && (
                        <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                          미인증
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>가입: {fmtDate(u.created_at)}</span>
                      <span>마지막 로그인: {fmtDate(u.last_sign_in_at)}</span>
                      <span>마지막 활동: {fmtDate(u.last_active_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400">
                    활동 {u.activity_count}건
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 py-3">
                    {detailLoading === u.id ? (
                      <div className="grid place-items-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : !rows.length ? (
                      <p className="py-2 text-xs text-muted-foreground">아직 저장된 활동이 없습니다.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-muted-foreground">
                          저장 항목: {u.activity_keys.join(", ") || "—"}
                        </div>
                        <div className="overflow-hidden rounded-xl border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-background/50 text-muted-foreground">
                              <tr>
                                <th className="px-3 py-1.5 text-left font-medium">항목</th>
                                <th className="px-3 py-1.5 text-left font-medium">업데이트</th>
                                <th className="px-3 py-1.5 text-left font-medium">미리보기</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, i) => {
                                const preview = (() => {
                                  try {
                                    const s = typeof r.value === "string" ? r.value : JSON.stringify(r.value);
                                    return s.length > 80 ? s.slice(0, 80) + "…" : s;
                                  } catch {
                                    return "—";
                                  }
                                })();
                                return (
                                  <tr key={`${r.key}-${i}`} className="border-t border-border">
                                    <td className="px-3 py-1.5 font-mono text-[11px]">{r.key}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{fmtDate(r.updated_at)}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground/80">{preview}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
