import { clickPattern } from "../music/meter";
import type { Meter } from "../music/types";

/** 순수 메트로놈 스케줄 계산 (브라우저 의존 없음). 시간 단위는 모두 4분음표 박 */

export type ClickLevel = 0 | 1 | 2;
export interface PatternClick {
  at: number;
  level: ClickLevel;
}
export interface ScheduledClick {
  /** 클릭 시각 (4분음표 박, 0 = 카운트인 첫 박) */
  beat: number;
  level: ClickLevel;
}

/** meter 가 있으면 clickPattern(meter), 없으면 beatsPerMeasure 만큼 정수 박 (첫 박 강, 나머지 중) */
export function patternFor(meter: Meter | undefined, beatsPerMeasure: number): PatternClick[] {
  if (meter) return clickPattern(meter);
  return Array.from({ length: beatsPerMeasure }, (_, i) => ({ at: i, level: (i === 0 ? 2 : 1) as ClickLevel }));
}

/**
 * startIndex 번째 클릭부터 beat < limitBeat 인 클릭을 시각 오름차순으로 모은다.
 * 전역 클릭 번호 k = 마디 * 패턴길이 + 패턴 내 순번.
 */
export function clicksBefore(
  pattern: PatternClick[],
  beatsPerMeasure: number,
  startIndex: number,
  limitBeat: number,
): { clicks: ScheduledClick[]; nextIndex: number } {
  const clicks: ScheduledClick[] = [];
  let k = startIndex;
  const n = pattern.length;
  if (n === 0) return { clicks, nextIndex: k };
  for (;;) {
    const p = pattern[k % n];
    const beat = Math.floor(k / n) * beatsPerMeasure + p.at;
    if (beat >= limitBeat) break;
    clicks.push({ beat, level: p.level });
    k++;
  }
  return { clicks, nextIndex: k };
}

/** 백그라운드 탭 복귀 등으로 이미 이만큼(초) 넘게 지난 클릭은 건너뜀 */
export const STALE_CLICK_SEC = 0.05;

/**
 * 재생할 가치가 있는 클릭만 남긴다. 클릭 시각 = t0 + beat * spb (AudioContext 시간).
 * 카운트인은 t0 가 현재보다 미래라 걸러지지 않는다.
 */
export function dropStaleClicks(clicks: ScheduledClick[], t0: number, spb: number, now: number): ScheduledClick[] {
  return clicks.filter((c) => t0 + c.beat * spb >= now - STALE_CLICK_SEC);
}
