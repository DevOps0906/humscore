"use client";

import { Cable, Mic, Piano } from "lucide-react";

export type RecordSource = "voice" | "instrument" | "midi";

export const RECORD_SOURCE_KEY = "humscore.record.source";

export function loadRecordSource(): RecordSource {
  try {
    const v = localStorage.getItem(RECORD_SOURCE_KEY);
    if (v === "voice" || v === "instrument" || v === "midi") return v;
  } catch {
    /* 저장소 사용 불가 */
  }
  return "voice";
}

export function saveRecordSource(s: RecordSource) {
  try {
    localStorage.setItem(RECORD_SOURCE_KEY, s);
  } catch {
    /* 저장소 사용 불가 */
  }
}

const OPTIONS = [
  { id: "voice", label: "목소리", Icon: Mic },
  { id: "instrument", label: "악기 소리 (마이크)", Icon: Piano },
  { id: "midi", label: "MIDI 건반", Icon: Cable },
] as const;

interface Props {
  value: RecordSource;
  onChange: (s: RecordSource) => void;
  disabled?: boolean;
}

export function RecordSourcePicker({ value, onChange, disabled }: Props) {
  return (
    <div role="group" aria-label="입력 방식" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ id, label, Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-xs font-medium outline-none transition focus-visible:ring-4 focus-visible:ring-ring/60 disabled:opacity-50 ${
              on ? "border-accent bg-accent/15 text-accent" : "border-line bg-card text-ink-soft hover:text-ink"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            <span className="text-center leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
