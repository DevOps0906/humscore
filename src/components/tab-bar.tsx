"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Mic, Piano } from "lucide-react";
import { AppLogo } from "@/components/app-logo";

const TABS = [
  { href: "/record", label: "녹음", icon: Mic },
  { href: "/library", label: "내 악보", icon: Library },
  { href: "/keys", label: "88건반", icon: Piano },
] as const;

/**
 * 주요 메뉴 — 화면 크기별로 모양이 바뀐다.
 *  모바일·태블릿(~1023px): 하단 탭바 (엄지 조작)
 *  데스크톱(1024px~)    : 좌측 고정 사이드바 (로고 + 세로 메뉴)
 */
export function TabBar() {
  const pathname = usePathname();
  if (pathname.endsWith("/perform") || pathname.startsWith("/welcome")) return null; // 공연 모드·소개 화면은 전체 화면
  return (
    <nav
      aria-label="주요 메뉴"
      data-app-nav
      className="no-print safe-bottom-tight fixed inset-x-0 bottom-0 z-20 bg-paper/95 backdrop-blur lg:inset-y-0 lg:right-auto lg:bottom-auto lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-line lg:bg-paper lg:px-4 lg:pb-6 lg:pt-5 lg:backdrop-blur-none"
    >
      <div className="hr-fade lg:hidden" aria-hidden />
      {/* 데스크톱 사이드바 전용 로고 (모바일·태블릿은 각 화면 상단에 로고가 있다) */}
      <AppLogo className="mb-4 hidden self-start lg:inline-flex" />
      <ul className="mx-auto flex max-w-md justify-around md:max-w-xl lg:mx-0 lg:max-w-none lg:flex-col lg:justify-start lg:gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/library" ? pathname.startsWith("/library") || pathname.startsWith("/scores") : pathname.startsWith(href);
          return (
            <li key={href} className="lg:w-full">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-20 flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs lg:min-h-12 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/60 md:min-w-28 md:text-sm lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${active ? "text-accent lg:bg-section/60" : "text-ink-soft hover:text-ink lg:hover:bg-section/40"}`}
              >
                <Icon className="size-6 lg:size-5" strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
