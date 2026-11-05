"use client";

import { DRUM_PIECES, type DrumPiece } from "@/lib/music/drums";
import { Button } from "@/components/ui/button";

/** 드럼과 심벌의 형태를 구분한 기기 내 벡터 그림. 선택은 타격 입력과 분리한다. */
function DrumShape({ piece }: { piece: DrumPiece }) {
  const cymbal = ["closedHat", "openHat", "pedalHat", "crash", "ride"].includes(piece.id);
  const kick = piece.id === "kick";
  return <svg viewBox="0 0 120 88" className="h-10 w-12 max-w-full" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  const placements: Record<string, [number, number]> = {
    crash: [100, 80], ride: [365, 95], closedHat: [60, 175], openHat: [60, 205], pedalHat: [65, 330],
    highTom: [190, 150], midTom: [285, 155], snare: [135, 245], rim: [135, 278], floorTom: [350, 255], kick: [240, 290],
  };
  return <div className="grid min-w-0 grid-cols-2 items-start gap-2 md:gap-4">
    <div role="group" aria-label="드럼 악기 그림 선택" className="grid min-w-0 grid-cols-2 gap-1 md:grid-cols-3 md:gap-2">
    {DRUM_PIECES.map((piece) => {
      const selected = selectedMidi === piece.midi;
      const active = activeMidis.includes(piece.midi);
      return <Button key={piece.id} type="button" variant="outline" aria-label={`${piece.label} 선택`} aria-pressed={selected} onClick={() => onSelect(piece.midi)}
        className={`h-auto min-h-11 min-w-0 flex-col gap-0.5 rounded-lg px-1 py-1.5 text-xs ${selected ? "border-accent bg-accent/15 text-accent" : ""}`}>
        <DrumShape piece={piece} />
        <span className="max-w-full whitespace-normal text-center">{piece.label}</span>
        {active && <span className="text-accent">현재 마디에 포함</span>}
      </Button>;
    })}
    </div>
    <div className="sticky top-4 min-w-0 rounded-xl border border-line bg-paper p-2 md:p-3">
      <h3 className="text-center text-xs font-semibold md:text-sm">전체 드럼셋</h3>
      <svg viewBox="0 0 440 410" className="w-full" role="group" aria-label="전체 드럼셋에서 선택">
        <g fill="none" stroke="var(--ink-soft)" strokeWidth="3" strokeLinecap="round">
          <path d="M100 90v220m0-50-35 80m35-80 35 80M365 105v230m0-50-35 65m35-65 35 65M60 185v140m0-45-30 65m30-65 30 65M135 255v100m0-35-35 50m35-50 35 50M350 270l25 95m-25-95-20 95M190 160l15 100m80-95-15 95" />
        </g>
        {DRUM_PIECES.map((piece) => {
          const [x, y] = placements[piece.id];
          const selected = selectedMidi === piece.midi;
          const active = activeMidis.includes(piece.midi);
          const cymbal = ["crash", "ride", "closedHat", "openHat", "pedalHat"].includes(piece.id);
          return <g key={piece.id} role="button" tabIndex={0} aria-label={`드럼셋 ${piece.label} 선택`} aria-pressed={selected} onClick={() => onSelect(piece.midi)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(piece.midi); }
          }} className="cursor-pointer outline-none focus-visible:stroke-accent" data-drum-piece={piece.id}>
            <title>{piece.label}{selected ? " · 선택됨" : ""}</title>
            {piece.id === "kick" ? <circle cx={x} cy={y} r="64" fill={selected ? "var(--accent)" : "var(--surface)"} fillOpacity={selected ? 0.35 : 1} stroke={selected || active ? "var(--accent)" : "var(--ink-soft)"} strokeWidth={selected ? 6 : 3} /> :
              <ellipse cx={x} cy={y} rx={cymbal ? 48 : 39} ry={cymbal ? 18 : 30} fill={selected ? "var(--accent)" : "var(--surface)"} fillOpacity={selected ? 0.35 : 1} stroke={selected || active ? "var(--accent)" : "var(--ink-soft)"} strokeWidth={selected ? 6 : 3} />}
            <text x={x} y={y + 4} textAnchor="middle" fontSize="13" fill="var(--ink)" pointerEvents="none">{piece.label}</text>
            {selected && <text x={x} y={y - (piece.id === "kick" ? 42 : 24)} textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--accent)" pointerEvents="none">선택됨</text>}
          </g>;
        })}
        <path d="M240 333v42m-10 0h20" stroke="var(--ink-soft)" strokeWidth="4" fill="none" pointerEvents="none" />
      </svg>
      <p className="text-center text-xs text-ink-soft" aria-live="polite">{DRUM_PIECES.find((piece) => piece.midi === selectedMidi)?.label} 선택 중</p>
    </div>
  </div>;
}
