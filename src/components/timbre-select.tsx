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

const selectClass = "h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

/**
 * 선택한 악기 종류 안에서 소리(음색)만 바꾼다. 선택지가 많아서 2단계로 나눈다:
 * 1단계 분류(예: 피아노·일렉피아노·신디사이저, 현악·목관·금관) → 2단계 세부 음색.
 * 음표와 악보는 그대로이고, 고르는 즉시 그 음색으로 한 음을 들려준다. 분류가 하나뿐이면 1단계는 숨긴다.
 */
export function TimbreSelect({ mode, value, onChange, className = "" }: {
  mode: CreationMode;
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
  className?: string;
}) {
  const groups = GROUPS[mode];
  if (!groups) return null;
  const group = groups.find((entry) => entry.instruments.includes(value)) ?? groups[0];
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 text-sm ${className}`}>
      <span className="hidden shrink-0 text-ink-soft sm:inline">음색</span>
      {groups.length > 1 && (
        <select
          aria-label="음색 분류"
          value={group.label}
          onChange={(event) => {
            const next = groups.find((entry) => entry.label === event.target.value);
            if (next) onChange(next.instruments[0]);
          }}
          className={selectClass}
        >
          {groups.map((entry) => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
        </select>
      )}
      <select aria-label="재생 음색" value={group.instruments.includes(value) ? value : group.instruments[0]} onChange={(event) => onChange(event.target.value as InstrumentId)} className={selectClass}>
        {group.instruments.map((id) => <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>)}
      </select>
    </div>
  );
}
