"use client";

import { useEffect, useState } from "react";
import { NAV_LINKS } from "./data";
import { goToHash } from "./use-hash";

/**
 * 헤더 섹션 nav. 현재 보이는 섹션을 강조하고(IntersectionObserver),
 * 문서 전체의 "#앵커" 링크 클릭을 부드러운 스크롤로 처리한다(탭·FAQ 해시 포함).
 */
export function LandingNav() {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      const href = a?.getAttribute("href");
      if (!href || href.length < 2) return;
      e.preventDefault();
      goToHash(href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const els = NAV_LINKS.map((l) => document.getElementById(l.href.slice(1))).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? "" : cur));
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav
      aria-label="주 메뉴"
      className="order-last -mx-2 flex w-full gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto md:overflow-visible"
    >
      {NAV_LINKS.map((l) => {
        const on = active === l.href.slice(1);
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={on ? "location" : undefined}
            className={`inline-flex min-h-[var(--tap-min)] flex-none items-center px-3 text-sm transition-colors ${
              on ? "text-ink underline decoration-accent decoration-2 underline-offset-8" : "text-ink-soft hover:text-ink"
            }`}
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
