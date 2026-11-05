"use client";

import { ARPEGGIO_PATTERNS, type AccompanimentSettings } from "@/lib/music/accompaniment";
import { Button } from "@/components/ui/button";

export interface AccompanimentSettingsPanelProps {
  value?: AccompanimentSettings;
  onChange: (value: AccompanimentSettings) => void;
}

/** 반주 방식과 템플릿을 함께 저장한다. 선택한 패턴은 화음 모드에서도 유지한다. */
export function AccompanimentSettingsPanel({ value, onChange }: AccompanimentSettingsPanelProps) {
  const mode = value?.mode ?? "block";
  const pattern = ARPEGGIO_PATTERNS.find((entry) => entry.id === value?.pattern) ?? ARPEGGIO_PATTERNS[0];
  return (
    <section aria-label="반주 설정" className="no-print grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-4">
      <label className="grid min-w-0 gap-1.5 text-sm md:max-w-sm">반주 모드
        <select aria-label="반주 모드" value={mode} onChange={(event) => {
          const selected = event.target.value;
          if (selected === "block" || selected === "arpeggio") onChange({ mode: selected, pattern: pattern.id });
        }} className="h-11 min-w-0 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          <option value="block">온음악보 · 화음</option>
          <option value="arpeggio">아르페지오</option>
        </select>
      </label>
      <p className="text-xs text-ink-soft">{mode === "block" ? "코드의 구성음을 동시에 길게 연주합니다." : "코드의 구성음을 선택한 패턴 순서로 나누어 연주합니다."}</p>
      {mode === "arpeggio" && <div className="grid min-w-0 gap-3">
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5" role="group" aria-label="아르페지오 템플릿">
          {ARPEGGIO_PATTERNS.map((entry) => <Button key={entry.id} type="button" variant={entry.id === pattern.id ? "default" : "outline"} aria-pressed={entry.id === pattern.id} onClick={() => onChange({ mode, pattern: entry.id })} className="h-auto min-h-11 min-w-0 whitespace-normal px-3 py-2 text-sm">
            {entry.label}
          </Button>)}
        </div>
        <p className="text-xs text-ink-soft" aria-live="polite">선택한 패턴: {pattern.label} · {pattern.description}</p>
      </div>}
    </section>
  );
}
