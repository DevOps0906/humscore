import type { DynamicEvent, DynamicLevel } from "./types";

/** 셈여림 단계 → MIDI velocity(0~1) */
export const DYNAMIC_VELOCITY: Record<DynamicLevel, number> = {
  pp: 0.3,
  p: 0.42,
  mp: 0.54,
  mf: 0.65,
  f: 0.8,
  ff: 0.95,
};

const LEVELS: DynamicLevel[] = ["pp", "p", "mp", "mf", "f", "ff"];
const EPS = 1e-6;

const isLevel = (k: DynamicEvent["kind"]): k is DynamicLevel => k !== "cresc" && k !== "dim";

function sortedEvents(dynamics: DynamicEvent[]): DynamicEvent[] {
  return dynamics.map((d, i) => ({ d, i })).sort((a, b) => a.d.startBeat - b.d.startBeat || a.i - b.i).map((x) => x.d);
}

/** beat 시점에 유효한 마지막 단계 기호(헤어핀은 건너뜀). 없으면 mf */
export function levelAt(dynamics: DynamicEvent[] | undefined, beat: number): DynamicLevel {
  let cur: DynamicLevel = "mf";
  for (const d of sortedEvents(dynamics ?? [])) {
    if (d.startBeat > beat + EPS) break;
    if (isLevel(d.kind)) cur = d.kind;
  }
  return cur;
}

function nearestLevelIndex(v: number): number {
  let best = 0;
  LEVELS.forEach((l, i) => {
    if (Math.abs(DYNAMIC_VELOCITY[l] - v) < Math.abs(DYNAMIC_VELOCITY[LEVELS[best]] - v)) best = i;
  });
  return best;
}

/**
 * beat 위치의 velocity(0~1). 기호가 없으면 mf.
 * 단계 기호는 다음 기호 전까지 유지. cresc/dim 은 durationBeats 동안 목표 단계로 선형 보간하고
 * 끝난 뒤에는 목표 값을 유지한다. 목표 = 구간 끝 이후 처음 나오는 단계 기호(없으면 한 단계 위/아래).
 */
export function velocityAt(dynamics: DynamicEvent[] | undefined, beat: number): number {
  const evs = sortedEvents(dynamics ?? []);
  let idx = -1;
  for (let i = 0; i < evs.length; i++) {
    if (evs[i].startBeat <= beat + EPS) idx = i;
    else break;
  }
  if (idx < 0) return DYNAMIC_VELOCITY.mf;
  const e = evs[idx];
  if (isLevel(e.kind)) return DYNAMIC_VELOCITY[e.kind];

  const from = velocityAt(evs.slice(0, idx), e.startBeat);
  const dur = e.durationBeats ?? 0;
  const end = e.startBeat + dur;
  const next = evs.find((d) => isLevel(d.kind) && d.startBeat >= end - EPS);
  let to: number;
  if (next && isLevel(next.kind)) to = DYNAMIC_VELOCITY[next.kind];
  else {
    const step = e.kind === "cresc" ? 1 : -1;
    const i = Math.min(LEVELS.length - 1, Math.max(0, nearestLevelIndex(from) + step));
    to = DYNAMIC_VELOCITY[LEVELS[i]];
  }
  const t = dur > 0 ? Math.min(1, Math.max(0, (beat - e.startBeat) / dur)) : 1;
  return from + (to - from) * t;
}
