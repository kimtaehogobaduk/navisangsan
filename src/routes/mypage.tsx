import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { loadProfile, saveProfile, type StudentProfile } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Edit3, Save, Clock, Star, BarChart2, BookOpen, Mic,
  MessageCircle, FileText, Target, LogIn, ChevronRight, Trash2, X,
} from "lucide-react";

export const Route = createFileRoute("/mypage")({
  head: () => ({ meta: [{ title: "마이페이지 — NAVI" }] }),
  component: MyPage,
});

// ── 사용 통계 ──
type UsageStats = {
  totalSessions: number;
  totalMinutes: number;
  aiChats: number;
  interviewCount: number;
  saengbuCount: number;
  roadmapGenerations: number;
};

function loadUsageStats(): UsageStats {
  if (typeof window === "undefined") return { totalSessions: 0, totalMinutes: 0, aiChats: 0, interviewCount: 0, saengbuCount: 0, roadmapGenerations: 0 };
  try {
    const raw = localStorage.getItem("navi.usageStats.v1");
    return raw ? JSON.parse(raw) as UsageStats : { totalSessions: 0, totalMinutes: 0, aiChats: 0, interviewCount: 0, saengbuCount: 0, roadmapGenerations: 0 };
  } catch { return { totalSessions: 0, totalMinutes: 0, aiChats: 0, interviewCount: 0, saengbuCount: 0, roadmapGenerations: 0 }; }
}

// ── 별표 AI 사용 기록 ──
type StarredItem = {
  id: string;
  type: "chat" | "interview" | "saengbu" | "roadmap" | "jasoseo";
  title: string;
  preview: string;
  createdAt: string;
  starred: boolean;
};

function loadStarredItems(): StarredItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("navi.starred.v1");
    return raw ? JSON.parse(raw) as StarredItem[] : [];
  } catch { return []; }
}

function saveStarredItems(items: StarredItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("navi.starred.v1", JSON.stringify(items));
}

// ── 최근 AI 사용 기록 (chat history 기반) ──
type ChatHistoryItem = { role: string; content: string; createdAt?: string };
function loadChatHistory(): ChatHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("navi.chatHistory");
    return raw ? JSON.parse(raw) as ChatHistoryItem[] : [];
  } catch { return []; }
}

// ── 앱 사용 시간 추적 ──
function recordSessionStart() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("navi.sessionStart", Date.now().toString());
}

function recordSessionEnd() {
  if (typeof window === "undefined") return;
  const start = sessionStorage.getItem("navi.sessionStart");
  if (!start) return;
  const minutes = Math.floor((Date.now() - parseInt(start)) / 60000);
  if (minutes < 1) return;
  try {
    const stats = loadUsageStats();
    stats.totalMinutes += minutes;
    stats.totalSessions += 1;
    localStorage.setItem("navi.usageStats.v1", JSON.stringify(stats));
  } catch { /* */ }
}

// 세션 추적 초기화 (앱 전체에서 한 번 호출)
if (typeof window !== "undefined") {
  recordSessionStart();
  window.addEventListener("beforeunload", recordSessionEnd);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") recordSessionEnd();
    else recordSessionStart();
  });
}

const GRADE_OPTIONS = ["중2", "중3", "고1", "고2", "고3", "N수"] as const;
const TRACK_OPTIONS = ["이과", "문과", "예체능", "미정"] as const;

function MyPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editProfile, setEditProfile] = useState<StudentProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"overview" | "history" | "starred">("overview");
  const [stats, setStats] = useState<UsageStats>(loadUsageStats);
  const [starredItems, setStarredItems] = useState<StarredItem[]>(loadStarredItems);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setEditProfile(p ? { ...p } : null);

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserEmail(s?.user?.email ?? null);
      setUserId(s?.user?.id ?? null);
    });

    const raw = loadChatHistory();
    setChatHistory(raw.filter(m => m.role === "user").slice(-30).reverse());

    return () => subscription.unsubscribe();
  }, []);

  function handleSaveProfile() {
    if (!editProfile) return;
    saveProfile(editProfile);
    setProfile({ ...editProfile });
    setEditMode(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleUnstar(id: string) {
    const updated = starredItems.filter(i => i.id !== id);
    setStarredItems(updated);
    saveStarredItems(updated);
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : profile?.name?.slice(0, 2) ?? "?";

  const displayName = profile?.name || userEmail?.split("@")[0] || "학생";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 헤더 카드 */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-4">
            {/* 아바타 */}
            <div className="relative">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-2xl font-bold text-brand-foreground shadow-glow">
                {initials}
              </div>
              {profile && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-brand-foreground">
                  {profile.grade}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{displayName}</h1>
              {userEmail && (
                <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
              )}
              {profile && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.school && `${profile.school} · `}{profile.targetUniversity} {profile.targetMajor}
                </p>
              )}
            </div>

            <button
              onClick={() => setEditMode(!editMode)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground hover:border-brand/40"
            >
              <Edit3 className="h-4 w-4" />
              <span className="hidden sm:inline">프로필 수정</span>
            </button>
          </div>

          {/* 로그인 유도 */}
          {!userEmail && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium">로그인하면 데이터가 클라우드에 저장됩니다</p>
                <p className="text-xs text-muted-foreground mt-0.5">기기 변경 시에도 모든 기록 유지</p>
              </div>
              <Link to="/login" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-2 text-sm font-semibold text-brand-foreground shadow-glow">
                <LogIn className="h-4 w-4" />로그인
              </Link>
            </div>
          )}
        </div>

        {/* 프로필 수정 폼 */}
        {editMode && editProfile && (
          <div className="rounded-2xl border border-brand/30 bg-surface p-5 space-y-4">
            <p className="text-sm font-semibold text-brand">프로필 수정</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">이름</label>
                <input
                  value={editProfile.name}
                  onChange={e => setEditProfile({ ...editProfile, name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="이름"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">학교</label>
                <input
                  value={editProfile.school}
                  onChange={e => setEditProfile({ ...editProfile, school: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="학교명"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">학년</label>
                <select
                  value={editProfile.grade}
                  onChange={e => setEditProfile({ ...editProfile, grade: e.target.value as StudentProfile["grade"] })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                >
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">계열</label>
                <select
                  value={editProfile.trackType}
                  onChange={e => setEditProfile({ ...editProfile, trackType: e.target.value as StudentProfile["trackType"] })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                >
                  {TRACK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">목표 대학</label>
                <input
                  value={editProfile.targetUniversity}
                  onChange={e => setEditProfile({ ...editProfile, targetUniversity: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="목표 대학교"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">목표 학과</label>
                <input
                  value={editProfile.targetMajor}
                  onChange={e => setEditProfile({ ...editProfile, targetMajor: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  placeholder="목표 학과"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">메모 (추가 정보)</label>
              <textarea
                value={editProfile.notes ?? ""}
                onChange={e => setEditProfile({ ...editProfile, notes: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none resize-none"
                placeholder="추가적으로 알려줄 내용..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-glow"
              >
                <Save className="h-4 w-4" />
                {saved ? "저장 완료!" : "저장하기"}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 탭 메뉴 */}
        <div className="flex gap-1 rounded-2xl border border-border bg-surface p-1">
          {([
            { id: "overview", label: "개요", icon: BarChart2 },
            { id: "history", label: "AI 사용 기록", icon: Clock },
            { id: "starred", label: "즐겨찾기", icon: Star },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition ${
                tab === t.id ? "bg-brand text-brand-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* 개요 탭 */}
        {tab === "overview" && (
          <div className="space-y-4">
            {/* 앱 사용 통계 */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold mb-4">앱 사용 통계</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon={Clock} label="총 사용 시간" value={`${stats.totalMinutes}분`} color="text-blue-400" />
                <StatCard icon={BookOpen} label="총 세션" value={`${stats.totalSessions}회`} color="text-purple-400" />
                <StatCard icon={MessageCircle} label="AI 대화" value={`${chatHistory.length}개`} color="text-cyan-400" />
                <StatCard icon={Mic} label="면접 연습" value={`${stats.interviewCount}회`} color="text-green-400" />
                <StatCard icon={FileText} label="생기부 생성" value={`${stats.saengbuCount}회`} color="text-yellow-400" />
                <StatCard icon={Target} label="로드맵 생성" value={`${stats.roadmapGenerations}회`} color="text-red-400" />
              </div>
            </div>

            {/* 프로필 요약 */}
            {profile ? (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold">내 프로필</p>
                  <button
                    onClick={() => navigate({ to: "/onboarding" })}
                    className="flex items-center gap-1 text-xs text-brand hover:underline"
                  >
                    전체 수정 <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <ProfileRow label="학년" value={profile.grade} />
                  <ProfileRow label="계열" value={profile.trackType} />
                  <ProfileRow label="학교" value={profile.school || "미입력"} />
                  <ProfileRow label="목표 대학" value={profile.targetUniversity || "미입력"} />
                  <ProfileRow label="목표 학과" value={profile.targetMajor || "미입력"} />
                  {profile.interests?.length > 0 && (
                    <div className="col-span-2">
                      <ProfileRow label="관심 분야" value={profile.interests.slice(0, 3).join(", ")} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center">
                <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">프로필을 아직 설정하지 않았어요</p>
                <Link to="/onboarding" className="mt-3 inline-block rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-glow">
                  프로필 설정하기
                </Link>
              </div>
            )}

            {/* 빠른 기능 링크 */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold mb-3">바로가기</p>
              <div className="grid grid-cols-2 gap-2">
                <QuickLink to="/coach" icon={MessageCircle} label="AI 코치와 대화" color="bg-cyan-500/10 text-cyan-400" />
                <QuickLink to="/interview" icon={Mic} label="면접 시뮬레이터" color="bg-purple-500/10 text-purple-400" />
                <QuickLink to="/saengbu" icon={FileText} label="생기부 세특 생성" color="bg-green-500/10 text-green-400" />
                <QuickLink to="/dashboard" icon={Target} label="내 로드맵" color="bg-blue-500/10 text-blue-400" />
              </div>
            </div>
          </div>
        )}

        {/* AI 사용 기록 탭 */}
        {tab === "history" && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">최근 AI 대화 기록</p>
              <span className="text-xs text-muted-foreground">{chatHistory.length}개</span>
            </div>
            {chatHistory.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                아직 AI 코치와 대화한 기록이 없어요.<br />
                <Link to="/coach" className="text-brand hover:underline">AI 코치와 대화하기 →</Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {chatHistory.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-3 hover:border-brand/30 transition">
                    <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-brand/10">
                      <MessageCircle className="h-4 w-4 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground line-clamp-2">{item.content.slice(0, 120)}</p>
                      {item.createdAt && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(item.createdAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 즐겨찾기 탭 */}
        {tab === "starred" && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">별표 표시한 항목</p>
              <span className="text-xs text-muted-foreground">{starredItems.length}개</span>
            </div>
            {starredItems.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Star className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">별표 표시한 항목이 없어요</p>
                <p className="text-xs text-muted-foreground">AI 코치, 면접, 생기부 기능에서<br/>별표를 눌러 저장해보세요</p>
              </div>
            ) : (
              <div className="space-y-2">
                {starredItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
                    <div className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg ${
                      item.type === "chat" ? "bg-cyan-500/10" :
                      item.type === "interview" ? "bg-purple-500/10" :
                      item.type === "saengbu" ? "bg-green-500/10" : "bg-blue-500/10"
                    }`}>
                      {item.type === "chat" ? <MessageCircle className="h-4 w-4 text-cyan-400" /> :
                       item.type === "interview" ? <Mic className="h-4 w-4 text-purple-400" /> :
                       item.type === "saengbu" ? <FileText className="h-4 w-4 text-green-400" /> :
                       <Target className="h-4 w-4 text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.preview}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(item.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (deleteConfirm === item.id) {
                          handleUnstar(item.id);
                          setDeleteConfirm(null);
                        } else {
                          setDeleteConfirm(item.id);
                        }
                      }}
                      className={`flex-shrink-0 rounded-lg p-1.5 transition ${
                        deleteConfirm === item.id ? "bg-red-500/20 text-red-400" : "text-muted-foreground hover:text-red-400"
                      }`}
                    >
                      {deleteConfirm === item.id ? <Trash2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <Icon className={`h-4 w-4 ${color} mb-1.5`} />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, color }: { to: string; icon: React.ElementType; label: string; color: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-xl border border-border p-3 transition hover:border-brand/30"
    >
      <div className={`grid h-7 w-7 place-items-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export { loadStarredItems, saveStarredItems, type StarredItem };
