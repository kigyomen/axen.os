"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav-items";

export function Sidebar() {
  const pathname = usePathname();

  // スマートフォン横向きでは、ページ(右側のメイン)をスクロールしてもSidebarが
  // 一緒に流れないよう、セーフエリアの上端に固定し(sticky)、画面の高さに収まらない
  // 場合はSidebarだけを独立してスクロールさせる。高さは、bodyのセーフエリア余白
  // (globals.css)を除いた、実際に見えている範囲(dvh)に合わせる。
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border md:flex md:flex-col md:gap-1.5 md:px-3 md:py-6 landscape-touch:sticky landscape-touch:top-[env(safe-area-inset-top)] landscape-touch:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] landscape-touch:self-start landscape-touch:overflow-y-auto landscape-touch:overscroll-contain">
      <div className="mb-7 px-3">
        <span className="text-lg font-semibold tracking-tight text-foreground">
          起業しよ。
        </span>
      </div>
      <nav aria-label="主要ナビゲーション" className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/[0.08] text-primary"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
