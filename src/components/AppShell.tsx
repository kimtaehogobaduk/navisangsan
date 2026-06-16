import { Link, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Compass, MessageCircle, FileText, Target, Home, LogIn, ShieldCheck, LogOut, LayoutGrid, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/mypage", label: "마이페이지", icon: User },
  { to: "/dashboard", label: "로드맵", icon: Home },
  { to: "/coach", label: "AI 코치", icon: MessageCircle },
  { to: "/saengbu", label: "생기부", icon: FileText },
  { to: "/jeonhyeong", label: "전형분석", icon: Target },
  { to: "/more", label: "더보기", icon: LayoutGrid },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdmin(sessionStorage.getItem("navi.admin") === "true");

    try {
      supabase.auth.getSession().then(({ data }) => {
        setUserEmail(data.session?.user?.email ?? null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUserEmail(session?.user?.email ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      // Supabase not configured
    }
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUserEmail(null);
  }

  // 이니셜 아바타
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : null;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">NAVI</span>
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 transition hover:bg-amber-500/20"
              >
                <ShieldCheck className="h-3 w-3" />
                관리자
              </Link>
            )}
            {userEmail ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/mypage"
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground hover:border-brand/40"
                >
                  <div className="grid h-4 w-4 place-items-center rounded-full bg-gradient-brand text-[8px] font-bold text-brand-foreground">
                    {initials}
                  </div>
                  <span className="hidden sm:inline">{userEmail.split("@")[0]}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                <LogIn className="h-3 w-3" />
                로그인
              </Link>
            )}
            <Link
              to="/onboarding"
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              프로필 수정
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-stretch justify-around px-2">
          {nav.map((item) => {
            const active =
              pathname === item.to ||
              (item.to === "/more" &&
                ["/subjects", "/curriculum", "/jasoseo", "/interview", "/parent", "/study-methods"].some((p) =>
                  pathname.startsWith(p),
                ));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] transition ${
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_8px_var(--brand)]" : ""}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
