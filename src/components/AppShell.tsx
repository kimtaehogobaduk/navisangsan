import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Compass, MessageCircle, FileText, Target, Home } from "lucide-react";

const nav = [
  { to: "/dashboard", label: "로드맵", icon: Home },
  { to: "/coach", label: "AI 코치", icon: MessageCircle },
  { to: "/saengbu", label: "생기부", icon: FileText },
  { to: "/jeonhyeong", label: "전형분석", icon: Target },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-brand text-brand-foreground shadow-glow">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">
              NAVI
            </span>
          </Link>
          <Link
            to="/onboarding"
            className="text-xs text-muted-foreground transition hover:text-foreground"
          >
            프로필 수정
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-stretch justify-around px-2">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
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
