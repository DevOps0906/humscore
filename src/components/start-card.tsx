"use client";

import { useState } from "react";
import Link from "next/link";

type Mode = "record" | "keys";

const PANELS: { id: Mode; tab: string; title: string; sub: string; cta: string; href: string }[] = [
  { id: "record", tab: "녹음", title: "떠오른 멜로디를 흥얼거려 보세요", sub: "30초면 코드 악보가 만들어져요", cta: "녹음 시작", href: "/record" },
  { id: "keys", tab: "건반 입력", title: "88건반을 눌러 음표를 적어요", sub: "음 길이를 고르고 건반을 누르면 바로 악보가 그려져요", cta: "건반으로 입력", href: "/keys?entry=1" },
];

export function StartCard() {
  const [mode, setMode] = useState<Mode>("record");

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-md" aria-label="새 악보 만들기">
      <div role="tablist" aria-label="입력 방식" className="flex gap-2">
        {PANELS.map((p) => {
          const on = mode === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`start-tab-${p.id}`}
              aria-selected={on}
              aria-controls={`start-panel-${p.id}`}
              onClick={() => setMode(p.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${on ? "border-accent text-accent" : "border-line text-ink-soft"}`}
            >
              {p.id === "record" ? <MicIcon /> : <KeysIcon />}
              {p.tab}
            </button>
          );
        })}
      </div>

      {/* 두 패널을 같은 grid 칸에 겹쳐 항상 큰 쪽 크기로 고정 */}
      <div className="grid">
        {PANELS.map((p) => {
          const on = mode === p.id;
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={`start-panel-${p.id}`}
              aria-labelledby={`start-tab-${p.id}`}
              aria-hidden={!on}
              className={`flex min-w-0 flex-col gap-4 [grid-area:1/1] ${on ? "" : "pointer-events-none invisible"}`}
            >
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-5 py-8 text-center">
                <span className="text-accent">{p.id === "record" ? <MicIcon size={36} /> : <KeysIcon size={36} />}</span>
                <strong className="font-medium">{p.title}</strong>
                <small className="text-xs text-ink-soft">{p.sub}</small>
              </div>
              <Link
                href={p.href}
                tabIndex={on ? 0 : -1}
                className="w-full rounded-lg border border-accent px-5 py-2.5 text-center text-sm font-medium text-accent"
              >
                {p.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}
function KeysIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 5v14M13 5v14M18 5v14" />
      <path d="M7 5h2v8H7zM12 5h2v8h-2zM17 5h2v8h-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}
