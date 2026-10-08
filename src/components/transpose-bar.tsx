"use client";

import { keyName, transposeKey } from "@/lib/music/theory";
import type { KeyInfo } from "@/lib/music/types";

/** 원클릭 전조 — 어느 화면에서든 엄지 범위(하단)에 고정해서 사용 */
export function TransposeBar({
  originalKey,
  transpose,
  onChange,
  large = false,
}: {
  originalKey: KeyInfo;
  transpose: number;
  onChange: (semitones: number) => void;
  large?: boolean;
}) {
  const current = transposeKey(originalKey, transpose);
  const clamp = (n: number) => Math.max(-12, Math.min(12, n));
  const btn = `rounded-full border border-line bg-surface font-medium active:scale-95 ${large ? "h-14 w-14 text-2xl" : "h-11 w-11 text-xl"}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2">
      <button type="button" className={btn} onClick={() => onChange(clamp(transpose - 1))} aria-label="반음 내리기">
        −
      </button>
      <button type="button" onClick={() => onChange(0)} className="flex flex-col items-center leading-tight" title="원래 키로">
        <span className={`font-semibold ${large ? "text-3xl" : "text-2xl"}`}>{keyName(current)}</span>
        <span className="text-xs text-ink-soft">
          원키 {keyName(originalKey)} {transpose !== 0 && `· ${transpose > 0 ? "+" : ""}${transpose}`}
        </span>
      </button>
      <button type="button" className={btn} onClick={() => onChange(clamp(transpose + 1))} aria-label="반음 올리기">
        +
      </button>
    </div>
  );
}
