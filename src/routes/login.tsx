import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Compass, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "로그인 — NAVI" }] }),
  component: LoginPage,
});

const ADMIN_ID = "Sangsanadmin";
const ADMIN_PW = "sangsanadmin";

type Tab = "signin" | "signup" | "admin";

function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "로그인 실패" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !pw) {
      setMessage({ type: "err", text: "이메일과 비밀번호를 입력해주세요." });
      return;
    }
    if (pw.length < 6) {
      setMessage({ type: "err", text: "비밀번호는 6자 이상이어야 합니다." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) throw error;
      setMessage({ type: "ok", text: "가입 완료! 이메일을 확인하거나 바로 로그인하세요." });
      setTab("signin");
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "회원가입 실패" });
    } finally {
      setLoading(false);
    }
  }

  function handleAdminLogin() {
    if (adminId === ADMIN_ID && adminPw === ADMIN_PW) {
      sessionStorage.setItem("navi.admin", "true");
      navigate({ to: "/admin" });
    } else {
      setMessage({ type: "err", text: "관리자 ID 또는 비밀번호가 올바르지 않습니다." });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-brand-foreground shadow-glow">
            <Compass className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">NAVI</h1>
            <p className="text-sm text-muted-foreground">AI 진로 컨설팅 플랫폼</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
          <div className="flex border-b border-border">
            {(["signin", "signup", "admin"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setMessage(null);
                }}
                className={`flex-1 py-3 text-sm font-medium transition ${
                  tab === t
                    ? "border-b-2 border-brand text-brand"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "signin" ? "로그인" : t === "signup" ? "회원가입" : "관리자"}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {message && (
              <div
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.type === "ok"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-destructive/10 text-destructive-foreground"
                }`}
              >
                {message.text}
              </div>
            )}

            {(tab === "signin" || tab === "signup") && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (tab === "signin" ? handleSignIn() : handleSignUp())}
                    placeholder="hello@example.com"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-brand"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (tab === "signin" ? handleSignIn() : handleSignUp())}
                      placeholder="6자 이상"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={tab === "signin" ? handleSignIn : handleSignUp}
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : tab === "signin" ? (
                    "로그인"
                  ) : (
                    "회원가입"
                  )}
                </button>
                {tab === "signin" && (
                  <p className="text-center text-xs text-muted-foreground">
                    계정이 없으신가요?{" "}
                    <button
                      onClick={() => setTab("signup")}
                      className="text-brand hover:underline"
                    >
                      회원가입
                    </button>
                  </p>
                )}
              </>
            )}

            {tab === "admin" && (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-amber-300">관리자 전용 영역</span>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">관리자 ID</label>
                  <input
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                    placeholder="ID 입력"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">비밀번호</label>
                  <input
                    type="password"
                    value={adminPw}
                    onChange={(e) => setAdminPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                    placeholder="PW 입력"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-amber-400"
                  />
                </div>
                <button
                  onClick={handleAdminLogin}
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
                >
                  관리자 로그인
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate({ to: "/onboarding" })}
          className="mt-4 w-full rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        >
          비회원으로 이용하기
        </button>
      </div>
    </div>
  );
}
