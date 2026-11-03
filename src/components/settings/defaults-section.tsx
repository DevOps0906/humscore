"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstrument } from "@/hooks/use-instrument";
import { INSTRUMENT_LABELS, INSTRUMENT_ORDER, isInstrumentId } from "@/lib/audio/instruments";
import { METERS } from "@/lib/music/meter";
import type { Meter } from "@/lib/music/types";
import { DEFAULT_BPM_MAX, DEFAULT_BPM_MIN, SCORE_DEFAULTS, loadScoreDefaults, saveScoreDefaults } from "@/lib/storage/preferences";
import { SettingsSection } from "./settings-section";

const selectCls =
  "h-11 min-w-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9";

/** 새 악보 기본 템포·박자(이 기기에 저장)와 재생 악기 */
export function DefaultsSection() {
  const [bpm, setBpm] = useState(SCORE_DEFAULTS.bpm);
  const [meter, setMeter] = useState<Meter>(SCORE_DEFAULTS.meter);
  const [instrument, setInstrument] = useInstrument();

  // 하이드레이션 후 저장값 복원
  useEffect(() => {
    const t = setTimeout(() => {
      const p = loadScoreDefaults();
      setBpm(p.bpm);
      setMeter(p.meter);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeBpm(v: number) {
    setBpm(saveScoreDefaults({ bpm: v }).bpm);
  }
  function changeMeter(m: Meter) {
    setMeter(saveScoreDefaults({ meter: m }).meter);
  }

  return (
    <SettingsSection id="defaults" title="기본값" description="새 악보(녹음·건반 입력·음원 파일)를 만들 때 처음 쓰는 값이에요. 바꾸면 바로 저장돼요.">
      <label className="flex items-center gap-3 text-sm">
        <span className="w-14 shrink-0 text-ink-soft">템포</span>
        <input
          type="range"
          aria-label="새 악보 기본 템포"
          min={DEFAULT_BPM_MIN}
          max={DEFAULT_BPM_MAX}
          step={1}
          value={bpm}
          onChange={(e) => changeBpm(+e.target.value)}
          className="min-w-0 flex-1 accent-accent"
        />
        <span className="w-16 text-right tabular-nums" data-testid="default-bpm">{bpm} BPM</span>
      </label>
      <p className="-mt-2 text-xs text-ink-soft">녹음 화면의 템포는 50~160 BPM 안으로 맞춰져요.</p>
      <div className="flex flex-wrap items-center gap-3 text-sm" role="group" aria-label="새 악보 기본 박자">
        <span className="w-14 shrink-0 text-ink-soft">박자</span>
        {METERS.map((m) => (
          <Button
            key={m.id}
            type="button"
            variant="outline"
            onClick={() => changeMeter(m.id)}
            aria-pressed={meter === m.id}
            className={`h-11 min-w-11 rounded-full px-5 lg:h-9 ${meter === m.id ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
          >
            {m.label}
          </Button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="w-14 shrink-0 text-ink-soft">악기</span>
        <select
          aria-label="재생 악기"
          value={instrument}
          onChange={(e) => isInstrumentId(e.target.value) && setInstrument(e.target.value)}
          className={selectCls}
        >
          {INSTRUMENT_ORDER.map((id) => (
            <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
          ))}
        </select>
      </label>
    </SettingsSection>
  );
}
