"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureFontStylesheet, formatCreditLines, formatTempo } from "@/components/score-header-logic";
import {
  DEFAULT_HEADER_FONT_ID,
  DEFAULT_HEADER_FONT_SIZE,
  HEADER_FONTS,
  HEADER_FONT_SIZE_MAX,
  HEADER_FONT_SIZE_MIN,
  clampHeaderFontSize,
  headerFontById,
} from "@/lib/music/header-fonts";
import { timeSignatureOf } from "@/lib/music/meter";
import { tempoTerm } from "@/lib/music/theory";
import type { Score } from "@/lib/music/types";

type HeaderScore = Pick<
  Score,
  "title" | "bpm" | "beatsPerMeasure" | "meter" | "lyricist" | "composer" | "arranger" | "headerFont" | "headerFontSize" | "headerFontWeight"
>;

/** 악보 위 머리글: 제목(가운데) + 빠르기말(왼쪽) / 작사·작곡·편곡(오른쪽). 인쇄에도 포함, 색은 검정 */
export function ScoreHeader({ score }: { score: HeaderScore }) {
  const font = headerFontById(score.headerFont);
  const size = clampHeaderFontSize(score.headerFontSize);
  useEffect(() => {
    ensureFontStylesheet(font);
  }, [font]);

  const ts = timeSignatureOf(score);
  const credits = formatCreditLines(score);

  return (
    <header
      data-testid="score-header"
      className="px-2 pb-2 text-black"
      style={{ fontFamily: font.stack, fontSize: size, fontWeight: score.headerFontWeight ?? 400, color: "#000" }}
    >
      <h1 className="text-center leading-tight break-words" style={{ fontSize: size * 1.7, fontWeight: score.headerFontWeight ?? 700 }}>
        {score.title}
      </h1>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p data-testid="score-header-tempo">
          {formatTempo(tempoTerm(score.bpm), score.bpm)}
          <span className="ml-2" style={{ fontSize: "0.8em" }}>
            {ts.beats}/{ts.beatType}
          </span>
        </p>
        {credits.length > 0 && (
          <div data-testid="score-header-credits" className="ml-auto grid gap-1 text-right">
            {credits.map((credit) => <p key={credit} data-testid="score-credit-line">{credit}</p>)}
          </div>
        )}
      </div>
    </header>
  );
}

/** 접었다 펴는 머리글 설정 (글꼴·글자 크기). 변경 즉시 onChange 로 저장 */
export function HeaderSettings({
  score,
  onChange,
}: {
  score: Pick<Score, "headerFont" | "headerFontSize" | "headerFontWeight">;
  onChange: (patch: { headerFont: string; headerFontSize: number; headerFontWeight?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const font = headerFontById(score.headerFont);
  const size = clampHeaderFontSize(score.headerFontSize);
  const set = (f: string, s: number, weight = score.headerFontWeight) => onChange({ headerFont: f, headerFontSize: clampHeaderFontSize(s), headerFontWeight: weight });

  return (
    <section className="no-print">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="h-11 rounded-full px-4 text-sm lg:h-9"
      >
        글꼴·크기·굵기 설정
        <ChevronDown aria-hidden className={open ? "rotate-180" : ""} />
      </Button>
      {open && (
        <div id={panelId} className="mt-2 grid gap-3 rounded-xl border border-line bg-surface p-3 text-sm md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-ink-soft">글꼴</span>
            <select
              value={font.id}
              onChange={(e) => {
                ensureFontStylesheet(headerFontById(e.target.value));
                set(e.target.value, size);
              }}
              aria-label="머리글 글꼴"
              className="h-11 rounded-md border border-input bg-transparent px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9 [&>option]:bg-surface"
            >
              {HEADER_FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-ink-soft">글자 굵기</span>
            <select aria-label="악보 글자 굵기" value={score.headerFontWeight ?? "default"} onChange={(event) => onChange({ headerFont: font.id, headerFontSize: size, headerFontWeight: event.target.value === "default" ? undefined : Number(event.target.value) })} className="h-11 rounded-md border border-input bg-surface px-2">
              <option value="default">기본 · 제목 굵게</option>
              <option value="400">보통 · 400</option><option value="500">중간 · 500</option><option value="600">약간 굵게 · 600</option><option value="700">굵게 · 700</option><option value="800">매우 굵게 · 800</option>
            </select>
          </label>
          <div className="grid gap-1">
            <span className="text-xs text-ink-soft">글자 크기 · {size}px</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" aria-label="글자 작게" disabled={size <= HEADER_FONT_SIZE_MIN} onClick={() => set(font.id, size - 1)} className="size-11 shrink-0 lg:size-9">
                <Minus aria-hidden />
              </Button>
              <input
                type="range"
                min={HEADER_FONT_SIZE_MIN}
                max={HEADER_FONT_SIZE_MAX}
                step={1}
                value={size}
                onChange={(e) => set(font.id, Number(e.target.value))}
                aria-label="머리글 글자 크기"
                className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
              />
              <Button type="button" variant="outline" aria-label="글자 크게" disabled={size >= HEADER_FONT_SIZE_MAX} onClick={() => set(font.id, size + 1)} className="size-11 shrink-0 lg:size-9">
                <Plus aria-hidden />
              </Button>
              <Button type="button" variant="ghost" onClick={() => onChange({ headerFont: DEFAULT_HEADER_FONT_ID, headerFontSize: DEFAULT_HEADER_FONT_SIZE, headerFontWeight: undefined })} className="h-11 px-3 lg:h-9">
                기본값
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
