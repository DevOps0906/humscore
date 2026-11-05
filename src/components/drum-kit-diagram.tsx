"use client";

import { DRUM_PIECES, type DrumPiece } from "@/lib/music/drums";
import { Button } from "@/components/ui/button";

/** 드럼과 심벌의 형태를 구분한 기기 내 벡터 그림. 선택은 타격 입력과 분리한다. */
function DrumShape({ piece }: { piece: DrumPiece }) {
  const cymbal = ["closedHat", "openHat", "pedalHat", "crash", "ride"].includes(piece.id);
  const kick = piece.id === "kick";
  return <svg viewBox="0 0 120 88" className="size-20 max-w-full" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  return <div role="group" aria-label="드럼 악기 그림 선택" className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
    {DRUM_PIECES.map((piece) => {
      const selected = selectedMidi === piece.midi;
      const active = activeMidis.includes(piece.midi);
      return <Button key={piece.id} type="button" variant="outline" aria-label={`${piece.label} 선택`} aria-pressed={selected} onClick={() => onSelect(piece.midi)}
        className={`h-auto min-w-0 flex-col gap-1 rounded-xl px-2 py-3 text-xs ${selected ? "border-accent bg-accent/15 text-accent" : ""}`}>
        <DrumShape piece={piece} />
        <span className="max-w-full whitespace-normal text-center">{piece.label}</span>
        <span className={active ? "text-accent" : "text-ink-soft"}>{active ? "현재 마디에 포함" : "현재 마디에 없음"}</span>
      </Button>;
    })}
  </div>;
}
