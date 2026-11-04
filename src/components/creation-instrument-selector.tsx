"use client";

import {
  ACOUSTIC_PIANOS, CREATION_MODES, ELECTRIC_PIANOS, GUITAR_INSTRUMENTS,
  INSTRUMENT_LABELS, ORCHESTRA_GROUPS, SYNTH_INSTRUMENTS, isInstrumentId,
  type CreationMode, type InstrumentId,
} from "@/lib/music/instrument-catalog";

export interface CreationInstrumentSelectorProps {
  mode: CreationMode;
  instrument: InstrumentId;
  onModeChange: (mode: CreationMode) => void;
  onInstrumentChange: (instrument: InstrumentId) => void;
}

const field = "h-11 min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

/** 악보 종류와 재생 음색을 분리하고 오케스트라는 악기군을 먼저 고른다. */
export function CreationInstrumentSelector({ mode, instrument, onModeChange, onInstrumentChange }: CreationInstrumentSelectorProps) {
  const group = ORCHESTRA_GROUPS.find((entry) => entry.instruments.includes(instrument)) ?? ORCHESTRA_GROUPS[0];
  const options = (ids: readonly InstrumentId[]) => ids.map((id) => <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>);
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="악보 생성 악기 설정">
      <label className="grid min-w-0 gap-1.5 text-sm">악기 선택
        <select aria-label="악기 선택" value={mode} onChange={(event) => {
          const selected = CREATION_MODES.find((entry) => entry.id === event.target.value);
          if (selected) onModeChange(selected.id);
        }} className={field}>
          {CREATION_MODES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>
      {mode === "orchestra" && <label className="grid min-w-0 gap-1.5 text-sm">악기군 선택
        <select aria-label="악기군 선택" value={group.id} onChange={(event) => {
          const selected = ORCHESTRA_GROUPS.find((entry) => entry.id === event.target.value);
          if (selected?.instruments[0]) onInstrumentChange(selected.instruments[0]);
        }} className={field}>
          {ORCHESTRA_GROUPS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>}
      <label className="grid min-w-0 gap-1.5 text-sm">{mode === "orchestra" ? "세부 악기·음색 선택" : "음색 선택"}
        <select aria-label="음색 선택" value={instrument} onChange={(event) => {
          if (isInstrumentId(event.target.value)) onInstrumentChange(event.target.value);
        }} className={field} disabled={mode === "drums"}>
          {mode === "piano" && <>
            <optgroup label="피아노">{options(ACOUSTIC_PIANOS)}</optgroup>
            <optgroup label="일렉피아노 10종">{options(ELECTRIC_PIANOS)}</optgroup>
            <optgroup label="신디사이저">{options(SYNTH_INSTRUMENTS)}</optgroup>
          </>}
          {mode === "guitarTab" && options(GUITAR_INSTRUMENTS)}
          {mode === "orchestra" && options(group.instruments)}
          {mode === "drums" && <option value="drumKit">드럼 키트</option>}
        </select>
      </label>
    </div>
  );
}
