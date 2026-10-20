import type { Meter } from "../music/types";
import { clicksBefore, patternFor } from "./metronome-schedule";
import { playClick } from "./piano-synth";

export interface ClickSchedulerOptions {
  spb: number;
  /** 카운트인 시작 시각 (AudioContext 시간) */
  t0: number;
  beatsPerMeasure: number;
  meter?: Meter;
  countInBeats: number;
  metronome: boolean;
}

/** 100ms 앞까지 미리 예약하는 메트로놈. 반환값은 정지 함수 */
export function startClickScheduler(ctx: AudioContext, o: ClickSchedulerOptions): () => void {
  const pattern = patternFor(o.meter, o.beatsPerMeasure);
  let next = 0;
  const id = setInterval(() => {
    const limit = (ctx.currentTime + 0.1 - o.t0) / o.spb;
    const r = clicksBefore(pattern, o.beatsPerMeasure, next, limit);
    next = r.nextIndex;
    for (const c of r.clicks) {
      if (c.beat < o.countInBeats || o.metronome) playClick(ctx, o.t0 + c.beat * o.spb, c.level);
    }
  }, 25);
  return () => clearInterval(id);
}
