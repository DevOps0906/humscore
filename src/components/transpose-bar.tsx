"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const btn = `rounded-full bg-paper ${large ? "size-14 [&_svg:not([class*='size-'])]:size-6" : "size-11 [&_svg:not([class*='size-'])]:size-5"}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2 shadow-md">
      <Button type="button" variant="outline" className={btn} onClick={() => onChange(clamp(transpose - 1))} aria-label="반음 내리기">
        <Minus aria-hidden />
      </Button>
      <button
        type="button"
        onClick={() => onChange(0)}
        className="flex min-h-11 flex-col items-center justify-center rounded-lg px-2 leading-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        title="원래 키로"
        aria-label={`현재 ${keyName(current)}키, 누르면 원래 키로`}
      >
        <span className={`font-semibold ${large ? "text-3xl" : "text-2xl"}`}>{keyName(current)}</span>
        <span className="text-xs text-ink-soft">
          원키 {keyName(originalKey)} {transpose !== 0 && `· ${transpose > 0 ? "+" : ""}${transpose}`}
        </span>
      </button>
      <Button type="button" variant="outline" className={btn} onClick={() => onChange(clamp(transpose + 1))} aria-label="반음 올리기">
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
