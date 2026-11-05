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
  ITEM_FONT_SIZE_MAX,
  ITEM_FONT_SIZE_MIN,
  clampHeaderFontSize,
  headerFontById,
  resolveTextSizes,
  type TextSizeField,
} from "@/lib/music/header-fonts";
import { timeSignatureOf } from "@/lib/music/meter";
import { tempoTerm } from "@/lib/music/theory";
import type { Score } from "@/lib/music/types";

type HeaderScore = Pick<
  Score,
  "title" | "bpm" | "beatsPerMeasure" | "meter" | "lyricist" | "composer" | "arranger" | "headerFont" | "headerFontSize" | "headerFontWeight"
> & Partial<Pick<Score, TextSizeField>>;

/** 악보 위 머리글: 제목은 가운데, 빠르기말·박자는 왼쪽, 작사/작곡/편곡은 오른쪽 끝. 인쇄에도 포함, 색은 검정 */
export function ScoreHeader({ score }: { score: HeaderScore }) {
  const font = headerFontById(score.headerFont);
  const sizes = resolveTextSizes(score);
  useEffect(() => {
    ensureFontStylesheet(font);
  }, [font]);

  const ts = timeSignatureOf(score);
  const credits = formatCreditLines(score);

  return (
    <header
      data-testid="score-header"
      className="px-2 pt-2 pb-4 text-center text-black"
      style={{ fontFamily: font.stack, fontSize: sizes.base, fontWeight: score.headerFontWeight ?? 400, color: "#000" }}
    >
      <h1 className="mx-auto max-w-full leading-tight break-words" style={{ fontSize: sizes.title, fontWeight: score.headerFontWeight ?? 700 }}>
        {score.title}
      </h1>
      {/* 빠르기·박자는 왼쪽, 작사·작곡·편곡자는 오른쪽 끝에 둔다 */}
      <div className="mt-2 flex items-start justify-between gap-4 text-left">
        <p data-testid="score-header-tempo" className="min-w-0 leading-snug">
          {formatTempo(tempoTerm(score.bpm), score.bpm)}
          <span className="ml-2" style={{ fontSize: "0.8em" }}>
            {ts.beats}/{ts.beatType}
          </span>
        </p>
        {credits.length > 0 && (
          <div data-testid="score-header-credits" className="grid min-w-0 justify-items-end gap-1 text-right leading-snug" style={{ fontSize: sizes.credit }}>
            {credits.map((credit) => <p key={credit} data-testid="score-credit-line">{credit}</p>)}
          </div>
        )}
      </div>
    </header>
  );
}

/** HeaderSettings 가 저장하는 값 전체. 항목별 크기가 undefined 면 기본 글자 크기를 따른다 */
export type HeaderPatch = {
  headerFont: string;
  headerFontSize: number;
  headerFontWeight?: number;
} & Partial<Record<TextSizeField, number | undefined>>;

const ITEM_CONTROLS: { field: TextSizeField; label: string; aria: string }[] = [
  { field: "titleFontSize", label: "제목", aria: "제목 글자 크기" },
  { field: "creditFontSize", label: "작사·작곡·편곡자", aria: "제작자 글자 크기" },
  { field: "lyricFontSize", label: "가사", aria: "가사 글자 크기" },
  { field: "chordFontSize", label: "코드", aria: "코드 글자 크기" },
];

/** 접었다 펴는 머리글 설정 (글꼴·글자 크기). 변경 즉시 onChange 로 저장 */
export function HeaderSettings({
  score,
  onChange,
}: {
  score: Pick<Score, "headerFont" | "headerFontSize" | "headerFontWeight"> & Partial<Pick<Score, TextSizeField>>;
  onChange: (patch: HeaderPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const font = headerFontById(score.headerFont);
  const sizes = resolveTextSizes(score);
  const size = sizes.base;
  const emit = (patch: Partial<HeaderPatch>) => onChange({
    headerFont: font.id,
    headerFontSize: size,
    headerFontWeight: score.headerFontWeight,
    titleFontSize: score.titleFontSize,
    creditFontSize: score.creditFontSize,
    lyricFontSize: score.lyricFontSize,
    chordFontSize: score.chordFontSize,
    ...patch,
  });
  const set = (f: string, s: number) => emit({ headerFont: f, headerFontSize: clampHeaderFontSize(s) });
  const itemValue = { titleFontSize: sizes.title, creditFontSize: sizes.credit, lyricFontSize: sizes.lyric, chordFontSize: sizes.chord } as const;

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
            <select aria-label="악보 글자 굵기" value={score.headerFontWeight ?? "default"} onChange={(event) => emit({ headerFontWeight: event.target.value === "default" ? undefined : Number(event.target.value) })} className="h-11 rounded-md border border-input bg-surface px-2">
              <option value="default">기본 · 제목 굵게</option>
              <option value="400">보통 · 400</option><option value="500">중간 · 500</option><option value="600">약간 굵게 · 600</option><option value="700">굵게 · 700</option><option value="800">매우 굵게 · 800</option>
            </select>
          </label>
          <div className="grid gap-1 md:col-span-2">
            <span className="text-xs text-ink-soft">기본 글자 크기 · {size}px (마디 번호·빠르기말 기준, 아래 항목을 따로 정하지 않으면 함께 바뀝니다)</span>
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange({ headerFont: DEFAULT_HEADER_FONT_ID, headerFontSize: DEFAULT_HEADER_FONT_SIZE, headerFontWeight: undefined, titleFontSize: undefined, creditFontSize: undefined, lyricFontSize: undefined, chordFontSize: undefined })}
                className="h-11 px-3 lg:h-9"
              >
                기본값
              </Button>
            </div>
          </div>
          {ITEM_CONTROLS.map(({ field, label, aria }) => {
            const value = itemValue[field];
            const custom = score[field] !== undefined;
            return (
              <div key={field} className="grid gap-1">
                <span className="text-xs text-ink-soft">{label} 글자 크기 · {value}px{custom ? "" : " (자동)"}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" aria-label={`${label} 작게`} disabled={value <= ITEM_FONT_SIZE_MIN} onClick={() => emit({ [field]: value - 1 })} className="size-11 shrink-0 lg:size-9">
                    <Minus aria-hidden />
                  </Button>
                  <input
                    type="range"
                    min={ITEM_FONT_SIZE_MIN}
                    max={ITEM_FONT_SIZE_MAX}
                    step={1}
                    value={value}
                    onChange={(e) => emit({ [field]: Number(e.target.value) })}
                    aria-label={aria}
                    className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
                  />
                  <Button type="button" variant="outline" aria-label={`${label} 크게`} disabled={value >= ITEM_FONT_SIZE_MAX} onClick={() => emit({ [field]: value + 1 })} className="size-11 shrink-0 lg:size-9">
                    <Plus aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" disabled={!custom} aria-label={`${label} 크기 자동`} onClick={() => emit({ [field]: undefined })} className="h-11 px-3 lg:h-9">
                    자동
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
