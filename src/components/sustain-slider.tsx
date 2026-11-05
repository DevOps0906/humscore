"use client";

import { useSustainRatio } from "@/hooks/use-sustain-ratio";
import { SUSTAIN_MAX, SUSTAIN_MIN, SUSTAIN_STEP } from "@/lib/audio/sustain";

/** 목관·금관·현악·보컬·패드처럼 길게 이어지는 소리의 음 길이를 조절한다. 피아노·기타·타악기에는 영향이 없다. */
export function SustainSlider({ className = "" }: { className?: string }) {
  const [ratio, setRatio] = useSustainRatio();
  const percent = Math.round(ratio * 100);
  return (
    <label className={`flex min-w-0 items-center gap-3 text-sm ${className}`}>
      <span className="shrink-0 text-ink-soft">음 길이</span>
      <input
        type="range"
        aria-label="지속음 길이"
        aria-valuetext={`${percent}%`}
        min={SUSTAIN_MIN}
        max={SUSTAIN_MAX}
        step={SUSTAIN_STEP}
        value={ratio}
        onChange={(event) => setRatio(Number(event.target.value))}
        className="h-11 min-w-0 flex-1 accent-accent"
      />
      <span className="w-10 shrink-0 text-right tabular-nums" aria-hidden>{percent}%</span>
    </label>
  );
}
