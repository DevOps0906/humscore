import { beatsPerMeasureOf } from "./meter";
import type { Meter } from "./types";

/** 건반 입력으로 만들 수 있는 음가(4분음표 = 1박): 온·점2분·2분·점4분·4분·점8분·8분·16분 */
export const HELD_NOTE_VALUES: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/** 누른 시간(ms)을 박 수(4분음표 단위)로 변환. bpm 은 분당 4분음표 수. 잘못된 입력은 0 */
export function heldMsToBeats(heldMs: number, bpm: number): number {
  if (!Number.isFinite(heldMs) || !Number.isFinite(bpm) || heldMs <= 0 || bpm <= 0) return 0;
  return (heldMs / 1000) * (bpm / 60);
}

/**
 * 건반을 누르고 있던 시간 → 가장 가까운 유효 음가(박 수).
 * - 박 수는 bpm 으로 환산하고, 마디 길이(박자)를 넘는 음가는 쓰지 않는다 (3/4·6/8 은 점2분까지).
 * - 후보 사이 정확히 중간이면 짧은 쪽. 아주 짧게 눌러도 최소 16분음표.
 */
export function quantizeHeldDuration(heldMs: number, bpm: number, meter: Meter): number {
  const beats = heldMsToBeats(heldMs, bpm);
  const max = beatsPerMeasureOf(meter);
  const candidates = HELD_NOTE_VALUES.filter((v) => v <= max + 1e-9);
  let best = candidates[0];
  for (const v of candidates) {
    if (Math.abs(v - beats) < Math.abs(best - beats) - 1e-9) best = v;
  }
  return best;
}
