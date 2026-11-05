"use client";

import Image from "next/image";
import { useState } from "react";
import { DRUM_PIECES, type DrumPiece } from "@/lib/music/drums";
import { Button } from "@/components/ui/button";

/** 드럼과 심벌의 형태를 구분한 기기 내 벡터 그림. 선택은 타격 입력과 분리한다. */
function DrumShape({ piece }: { piece: DrumPiece }) {
  const cymbal = ["closedHat", "openHat", "pedalHat", "crash", "ride"].includes(piece.id);
  const kick = piece.id === "kick";
  return <svg viewBox="0 0 120 88" className={`${kick ? "h-20 w-24" : "h-8 w-11"} max-w-full shrink-0`} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {cymbal ? <>
      <path d="M60 31v43m0-10L44 80m16-16 16 16" />
      <ellipse cx="60" cy="30" rx={piece.id === "ride" || piece.id === "crash" ? 43 : 34} ry="10" fill="currentColor" fillOpacity="0.15" />
      <path d="M51 28q9-12 18 0M60 20v-7" />
      {piece.id === "closedHat" && <path d="M27 36q33 13 66 0" />}
      {piece.id === "openHat" && <path d="M27 43q33 13 66 0" />}
      {piece.id === "pedalHat" && <path d="m59 71 12 6-17 5-7-6Z" />}
      {piece.id === "crash" && <path d="m100 13 6-5m-1 17 8-1" />}
    </> : kick ? <>
      <circle cx="60" cy="42" r="33" fill="currentColor" fillOpacity="0.12" />
      <circle cx="60" cy="42" r="27" />
      <circle cx="74" cy="53" r="7" />
      <path d="m32 62-9 16m65-16 9 16M60 64v15m-8 0h16" />
    </> : <>
      <path d="M24 26v30c0 15 72 15 72 0V26" fill="currentColor" fillOpacity="0.12" />
      <ellipse cx="60" cy="26" rx="36" ry="14" />
      <ellipse cx="60" cy="26" rx="29" ry="9" />
      <path d="M26 53q34 19 68 0M35 36v23m25-18v23m25-28v23" />
      {piece.id === "floorTom" ? <path d="m28 59-6 22m38-13v13m32-22 6 22" /> : <path d="M60 66v12m0-4-14 8m14-8 14 8" />}
      {piece.id === "rim" && <path d="m26 8 60 31m-5-33-39 38" strokeWidth="4" />}
      {piece.id === "snare" && <path d="M41 66v5m8-4v5m8-4v5m8-5v5m8-6v5" />}
    </>}
  </svg>;
}

export function DrumKitDiagram({ selectedMidi, activeMidis, onSelect }: {
  selectedMidi: number;
  activeMidis: readonly number[];
  onSelect: (midi: number) => void;
}) {
  const [showWholeKit, setShowWholeKit] = useState(false);
  // 원본 그림의 드럼 위치에 맞춘 선택 영역. 같은 하이햇의 개방·닫힘·페달은 별도로 선택한다.
  const placements: Record<string, [number, number, number, number]> = {
    crash: [217, 226, 38, 16], ride: [376, 229, 47, 22],
    closedHat: [176, 274, 34, 7], openHat: [176, 285, 34, 7], pedalHat: [192, 425, 20, 24],
    highTom: [276, 267, 25, 14], midTom: [334, 267, 26, 14],
    snare: [246, 323, 34, 16], rim: [246, 304, 34, 7],
    floorTom: [373, 323, 42, 21], kick: [303, 379, 48, 49],
  };
  return <div className="grid min-w-0 grid-cols-2 items-start gap-2 md:gap-4">
    <div role="group" aria-label="드럼 악기 그림 선택" className="grid min-w-0 grid-cols-2 auto-rows-[calc(var(--spacing)*22)] items-start gap-1 md:grid-cols-3 md:gap-2">
    {DRUM_PIECES.map((piece) => {
      const selected = selectedMidi === piece.midi;
      const active = activeMidis.includes(piece.midi);
      return <Button key={piece.id} type="button" variant="outline" aria-label={`${piece.label} 선택`} aria-pressed={selected} onClick={() => onSelect(piece.midi)}
        data-drum-card={piece.id}
        className={`relative min-w-0 flex-col justify-center gap-1 rounded-xl px-1 py-2 text-xs shadow-sm transition-colors ${piece.id === "kick" ? "row-span-2 h-44" : "h-22"} ${selected ? "border-accent bg-accent/15 text-accent" : "bg-paper hover:border-accent/60 hover:bg-accent/5"}`}>
        <DrumShape piece={piece} />
        <span className="flex min-h-8 max-w-full items-center justify-center whitespace-normal text-center leading-4">{piece.label}</span>
        {active && <span className="absolute top-1 right-1 size-2 rounded-full bg-accent"><span className="sr-only">현재 마디에 포함</span></span>}
      </Button>;
    })}
    </div>
    <div className="sticky top-4 grid min-w-0 gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm md:gap-3 md:p-3">
      <h3 className="text-center text-xs font-semibold md:text-sm">전체 드럼셋</h3>
      <div className="relative overflow-hidden rounded-xl bg-score-paper shadow-sm" role="group" aria-label="전체 드럼셋에서 선택"
        style={{ aspectRatio: showWholeKit ? "596 / 619" : "365 / 290" }}>
        <Image src="/images/drum-kit.png" width={596} height={619} alt="드럼셋과 구성 악기의 악보 위치 참고 그림" className="absolute block max-w-none" unoptimized
          style={showWholeKit ? { left: 0, top: 0, width: "100%", height: "100%" } : {
            left: `${-115 / 365 * 100}%`, top: `${-180 / 290 * 100}%`,
            width: `${596 / 365 * 100}%`, height: `${619 / 290 * 100}%`,
          }} />
        <svg viewBox={showWholeKit ? "0 0 596 619" : "115 180 365 290"} className="absolute inset-0 h-full w-full" aria-label="드럼셋 악기 선택 영역">
        {DRUM_PIECES.map((piece) => {
          const [x, y, rx, ry] = placements[piece.id];
          const selected = selectedMidi === piece.midi;
          const active = activeMidis.includes(piece.midi);
          return <g key={piece.id} role="button" tabIndex={0} aria-label={`드럼셋 ${piece.label} 선택`} aria-pressed={selected} onClick={() => onSelect(piece.midi)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(piece.midi); }
          }} className="group cursor-pointer outline-none" data-drum-piece={piece.id}>
            <title>{piece.label}{selected ? " · 선택됨" : ""}</title>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--accent)" fillOpacity={selected ? 0.25 : 0}
              stroke={selected || active ? "var(--accent)" : "transparent"} strokeWidth={selected ? 5 : 2}
              className="transition-colors group-hover:fill-accent/15 group-hover:stroke-accent group-focus-visible:fill-accent/15 group-focus-visible:stroke-accent" />
          </g>;
        })}
        </svg>
      </div>
      <Button type="button" variant="outline" aria-pressed={showWholeKit} onClick={() => setShowWholeKit((showing) => !showing)} className="h-11 w-full whitespace-normal px-2 text-xs">
        {showWholeKit ? "드럼셋 확대 보기" : "전체 그림 보기"}
      </Button>
      <p className="rounded-lg bg-accent/10 px-2 py-2 text-center text-xs font-medium text-accent" aria-live="polite">{DRUM_PIECES.find((piece) => piece.midi === selectedMidi)?.label} 선택 중</p>
    </div>
  </div>;
}
