"use client";

import {
  ACOUSTIC_PIANOS, ELECTRIC_PIANOS, GUITAR_INSTRUMENTS, INSTRUMENT_LABELS, ORCHESTRA_GROUPS, SYNTH_INSTRUMENTS,
  type CreationMode, type InstrumentId,
} from "@/lib/music/instrument-catalog";

const GROUPS: Partial<Record<CreationMode, readonly { label: string; instruments: readonly InstrumentId[] }[]>> = {
  piano: [
    { label: "피아노", instruments: ACOUSTIC_PIANOS },
    { label: "일렉피아노", instruments: ELECTRIC_PIANOS },
    { label: "신디사이저", instruments: SYNTH_INSTRUMENTS },
  ],
  guitarTab: [{ label: "기타", instruments: GUITAR_INSTRUMENTS }],
  orchestra: ORCHESTRA_GROUPS.filter((group) => group.id !== "percussion" && group.id !== "timpani").map((group) => ({ label: group.label, instruments: group.instruments as readonly InstrumentId[] })),
};

/** 선택한 악기 종류 안에서 소리(음색)만 바꾼다. 음표와 악보는 그대로이고, 고르는 즉시 그 음색으로 한 음을 들려준다. */
export function TimbreSelect({ mode, value, onChange, className = "" }: {
  mode: CreationMode;
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
  className?: string;
}) {
  const groups = GROUPS[mode];
  if (!groups) return null;
  return (
    <label className={`flex min-w-0 items-center gap-2 text-sm ${className}`}>
      <span className="shrink-0 text-ink-soft">음색</span>
      <select
        aria-label="재생 음색"
        value={value}
        onChange={(event) => onChange(event.target.value as InstrumentId)}
        className="h-11 min-w-0 max-w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.instruments.map((id) => <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
