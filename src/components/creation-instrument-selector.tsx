"use client";

import {
  ACOUSTIC_PIANOS, CREATION_MODES, ELECTRIC_PIANOS, GUITAR_INSTRUMENTS,
  INSTRUMENT_LABELS, ORCHESTRA_GROUPS, SYNTH_INSTRUMENTS, isInstrumentId,
  type CreationMode, type InstrumentId,
} from "@/lib/music/instrument-catalog";
import { DRUM_PIECES } from "@/lib/music/drums";
import { Button } from "@/components/ui/button";

export interface CreationInstrumentSelectorProps {
  mode: CreationMode;
  instrument: InstrumentId;
  onModeChange: (mode: CreationMode) => void;
  onInstrumentChange: (instrument: InstrumentId) => void;
}

const field = "h-11 min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

const PIANO_GROUPS = [
  { id: "acoustic", label: "피아노", instruments: ACOUSTIC_PIANOS },
  { id: "electric", label: "일렉피아노", instruments: ELECTRIC_PIANOS },
  { id: "synth", label: "신디사이저 악기", instruments: SYNTH_INSTRUMENTS },
] as const;

/** 악보 종류와 재생 음색을 분리하고 오케스트라는 악기군을 먼저 고른다. */
export function CreationInstrumentSelector({ mode, instrument, onModeChange, onInstrumentChange }: CreationInstrumentSelectorProps) {
  const group = ORCHESTRA_GROUPS.find((entry) => (entry.instruments as readonly InstrumentId[]).includes(instrument)) ?? ORCHESTRA_GROUPS[0];
  const pianoGroup = PIANO_GROUPS.find((entry) => (entry.instruments as readonly InstrumentId[]).includes(instrument)) ?? PIANO_GROUPS[0];
  const options = (ids: readonly InstrumentId[]) => ids.map((id) => <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>);
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3" aria-label="악보 생성 악기 설정">
      <label className="grid min-w-0 gap-1.5 text-sm">악기 선택
        <select aria-label="악기 선택" value={mode} onChange={(event) => {
          const selected = CREATION_MODES.find((entry) => entry.id === event.target.value);
          if (selected) onModeChange(selected.id);
        }} className={field}>
          {CREATION_MODES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>
      {mode === "piano" && <label className="grid min-w-0 gap-1.5 text-sm">피아노 종류 선택
        <select aria-label="피아노 종류 선택" value={pianoGroup.id} onChange={(event) => {
          const selected = PIANO_GROUPS.find((entry) => entry.id === event.target.value);
          if (selected) onInstrumentChange(selected.instruments[0]);
        }} className={field}>
          {PIANO_GROUPS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>}
      {mode === "orchestra" && <label className="grid min-w-0 gap-1.5 text-sm">악기군 선택
        <select aria-label="악기군 선택" value={group.id} onChange={(event) => {
          const selected = ORCHESTRA_GROUPS.find((entry) => entry.id === event.target.value);
          if (selected?.instruments[0]) onInstrumentChange(selected.instruments[0]);
        }} className={field}>
          {ORCHESTRA_GROUPS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>}
      {(mode === "guitarTab" || mode === "orchestra") && <label className="grid min-w-0 gap-1.5 text-sm">{mode === "orchestra" ? "세부 악기·음색 선택" : "기타 종류 선택"}
        <select aria-label="음색 선택" value={instrument} onChange={(event) => {
          if (isInstrumentId(event.target.value)) onInstrumentChange(event.target.value);
        }} className={field}>
          {mode === "guitarTab" && options(GUITAR_INSTRUMENTS)}
          {mode === "orchestra" && options(group.instruments)}
        </select>
      </label>}
      {mode === "piano" && <details className="min-w-0 rounded-lg border border-line bg-surface px-3 md:col-span-2 lg:col-span-3">
        <summary className="cursor-pointer py-3 text-sm focus-visible:outline-ring">음색 프리셋 · {INSTRUMENT_LABELS[instrument]}</summary>
        <div className="flex min-w-0 flex-wrap gap-2 pb-3" role="group" aria-label={`${pianoGroup.label} 음색 프리셋`}>
          {pianoGroup.instruments.map((id) => <Button key={id} type="button" variant={instrument === id ? "default" : "outline"} aria-pressed={instrument === id} onClick={() => onInstrumentChange(id)} className="min-h-11 max-w-full whitespace-normal px-3 py-2">
            {INSTRUMENT_LABELS[id]}
          </Button>)}
        </div>
      </details>}
      {mode === "drums" && <div className="min-w-0 rounded-lg border border-line bg-surface p-3 text-sm md:col-span-2 lg:col-span-3" aria-label="드럼 음표 안내">
        <p className="font-medium">드럼 음표</p>
        <p className="mt-1 text-xs text-ink-soft">일반 음표 머리는 킥·스네어·탐, X형 머리는 하이햇·심벌·림을 표시합니다. 아래 리듬 격자에서 입력하세요.</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {DRUM_PIECES.map((piece) => <li key={piece.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="font-semibold">{piece.head === "x" ? "×" : "●"}{piece.id === "openHat" ? "○" : ""}</span>
            {piece.label}
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
