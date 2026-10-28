"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";

/** 모바일 하단 고정 CTA. 본문의 주 CTA([data-cta])가 보이면 숨긴다. */
export function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll("[data-cta]");
    const visible = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setShow(visible.size === 0);
    });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-5 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.625rem)] md:hidden">
      <Link
        href="/record"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-bold text-accent-ink hover:bg-lavender-300"
      >
        <Mic className="size-5" aria-hidden />
        흥얼거려 보기
      </Link>
    </div>
  );
}
