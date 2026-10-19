"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Mic, Piano } from "lucide-react";

const TABS = [
  { href: "/record", label: "녹음", icon: Mic },
  { href: "/library", label: "내 악보", icon: Library },
  { href: "/keys", label: "88건반", icon: Piano },
] as const;

export function TabBar() {
  const pathname = usePathname();
  if (pathname.endsWith("/perform") || pathname.startsWith("/welcome")) return null; // 공연 모드·소개 화면은 전체 화면
  return (
    <nav aria-label="주요 메뉴" className="no-print safe-bottom fixed inset-x-0 bottom-0 z-20 bg-paper/95 backdrop-blur">
      <div className="hr-fade" aria-hidden />
      <ul className="mx-auto flex max-w-md justify-around pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/library" ? pathname.startsWith("/library") || pathname.startsWith("/scores") : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 min-w-20 flex-col items-center justify-center gap-1 rounded-lg px-3 py-1 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/60 ${active ? "text-accent" : "text-ink-soft hover:text-ink"}`}
              >
                <Icon className="size-6" strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
