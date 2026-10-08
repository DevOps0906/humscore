"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/record/", label: "녹음", icon: MicIcon },
  { href: "/library/", label: "내 악보", icon: LibraryIcon },
  { href: "/keys/", label: "88건반", icon: KeysIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/perform") || pathname.startsWith("/welcome") || pathname === "/") return null; // 공연 모드·소개·랜딩 이동 화면은 전체 화면
  return (
    <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-20 bg-paper/95 backdrop-blur">
      <div className="hr-fade" aria-hidden />
      <ul className="mx-auto flex max-w-md justify-around pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/library/" ? pathname.startsWith("/library") || pathname.startsWith("/score") : pathname.startsWith(href.slice(0, -1));
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-1 text-xs ${active ? "text-accent" : "text-ink-soft"}`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
function LibraryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" />
      <circle cx="9" cy="16" r="2" fill="currentColor" />
    </svg>
  );
}
function KeysIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 5v14M13 5v14M18 5v14" />
      <path d="M7 5h2v8H7zM12 5h2v8h-2zM17 5h2v8h-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}
