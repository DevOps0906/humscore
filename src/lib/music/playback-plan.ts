/** 공연 모드·연습 재생 계획 — 순수 함수. 소리 예약은 audio/ 가 이 계획을 받아서 한다. */
import { hairpinTargets, levelAt } from "./dynamics";
import { measureOf, scoreMeasureCount } from "./edit";
import { measureOrder, unrollScore } from "./form";
import type { ChordEvent, DynamicEvent, KeyInfo, Score } from "./types";

const EPS = 1e-6;

/** 재생 속도 단계(원래 bpm 대비 배율), 10% 단위 */
export const PLAYBACK_RATES = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const;

/** 구간 A–B. 화면에 보이는 마디 번호(1부터), 양 끝 포함 */
export interface PlaybackRange {
  startMeasure: number;
  endMeasure: number;
}

export interface PlannedNote {
  /** 계획 시작부터의 박 */
  startBeat: number;
  durationBeats: number;
  /** 원본 MIDI(전조 미적용). null = 쉼표 */
  midi: number | null;
  /** 원본 score.notes 인덱스 */
  noteIndex: number;
}

export interface PlaybackPlan {
  /** 펼친(또는 A–B) 순서의 음·쉼표 */
  notes: PlannedNote[];
  /** 계획 박 기준 코드(원본 기호, 전조 미적용) */
  chords: ChordEvent[];
  /** 계획 박 기준 셈여림 — velocityAt 에 그대로 넘긴다. 구간 앞 헤어핀이 걸치면 음수 박 기호가 들어 있을 수 있다 */
  dynamics: DynamicEvent[];
  /** 계획 길이(박). 구간 없음: 마지막 음 끝 / 구간: (B−A+1) 마디 */
  totalBeats: number;
  bpm: number;
  beatsPerMeasure: number;
  transpose: number;
  key: KeyInfo;
  /** 실제 적용된 구간(보정 후). 구간 없으면 null */
  range: PlaybackRange | null;
  /** 커서용: 시작 박 오름차순, 같은 박은 맨 위 음(모두 쉼표면 첫 쉼표) 하나 */
  cursor: { beat: number; noteIndex: number }[];
}

/** 가장 가까운 속도 단계로 맞춘다(50~100%) */
export function normalizeRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  let best: number = PLAYBACK_RATES[0];
  for (const r of PLAYBACK_RATES) if (Math.abs(r - rate) < Math.abs(best - rate)) best = r;
  return best;
}

/** 실제 박 길이(초) = 60 / (bpm × rate) */
export function secondsPerBeat(bpm: number, rate: number): number {
  return 60 / (bpm * normalizeRate(rate));
}

/** 구간 보정: 정수, 1..마디 수, A ≤ B */
export function clampRange(score: Score, range: PlaybackRange): PlaybackRange {
  const total = scoreMeasureCount(score);
  const clamp = (v: number) => Math.min(total, Math.max(1, Number.isFinite(v) ? Math.round(v) : 1));
  const a = clamp(range.startMeasure);
  return { startMeasure: a, endMeasure: Math.max(a, clamp(range.endMeasure)) };
}

function buildCursor(notes: PlannedNote[]): PlaybackPlan["cursor"] {
  const sorted = [...notes].sort((x, y) => x.startBeat - y.startBeat);
  const out: PlaybackPlan["cursor"] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    let pick = sorted[i];
    while (j < sorted.length && Math.abs(sorted[j].startBeat - sorted[i].startBeat) < EPS) {
      const m = sorted[j].midi;
      if (m !== null && (pick.midi === null || m > pick.midi)) pick = sorted[j];
      j++;
    }
    out.push({ beat: sorted[i].startBeat, noteIndex: pick.noteIndex });
    i = j;
  }
  return out;
}

/**
 * 재생 계획. range 없으면 도돌이표를 펼친 순서(unrollScore 와 같은 박·길이·MIDI),
 * range 있으면 A→B 를 한 번(구간 안 도돌이표·D.C. 무시), B 끝을 넘는 음은 자르고 첫 박 코드·셈여림을 보충한다.
 */
export function buildPlaybackPlan(score: Score, range?: PlaybackRange): PlaybackPlan {
  const bpm = score.beatsPerMeasure;
  const total = scoreMeasureCount(score);
  const inMeasure = (beat: number, m: number) => Math.min(total - 1, measureOf(beat, bpm)) === m;
  const base = { bpm: score.bpm, beatsPerMeasure: bpm, transpose: score.transpose, key: score.key };

  if (!range) {
    const unrolled = unrollScore(score);
    // unrollScore 와 같은 순회로 원본 인덱스를 얻는다(마디 순서 × 원본 음 순서)
    const srcs: number[] = [];
    for (const m of measureOrder(score)) score.notes.forEach((n, i) => inMeasure(n.startBeat, m) && srcs.push(i));
    const notes = unrolled.notes.map((n, k) => ({ startBeat: n.startBeat, durationBeats: n.durationBeats, midi: n.midi, noteIndex: srcs[k] }));
    return {
      ...base,
      notes,
      chords: unrolled.chords,
      dynamics: unrolled.dynamics ?? [],
      totalBeats: notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0),
      range: null,
      cursor: buildCursor(notes),
    };
  }

  const r = clampRange(score, range);
  const a = r.startMeasure - 1;
  const b = r.endMeasure - 1;
  const from = a * bpm;
  const to = (b + 1) * bpm;
  const inRange = (beat: number) => {
    const m = Math.min(total - 1, measureOf(beat, bpm));
    return m >= a && m <= b;
  };

  const notes: PlannedNote[] = [];
  score.notes.forEach((n, i) => {
    if (!inRange(n.startBeat)) return;
    notes.push({ startBeat: n.startBeat - from, durationBeats: Math.min(n.durationBeats, to - n.startBeat), midi: n.midi, noteIndex: i });
  });

  const chords: ChordEvent[] = score.chords.filter((c) => inRange(c.startBeat)).map((c) => ({ ...c, startBeat: c.startBeat - from }));
  if (!chords.some((c) => Math.abs(c.startBeat) < EPS)) {
    let prev: ChordEvent | undefined;
    for (const c of score.chords) if (c.startBeat <= from + EPS && (!prev || c.startBeat >= prev.startBeat)) prev = c;
    if (prev) chords.unshift({ ...prev, startBeat: 0 });
  }

  const srcDyn = score.dynamics ?? [];
  const isLevelEv = (d: DynamicEvent) => d.kind !== "cresc" && d.kind !== "dim";
  const copyOf = new Map<DynamicEvent, DynamicEvent>();
  const dynamics: DynamicEvent[] = [];
  const here = srcDyn.filter((d) => inRange(d.startBeat));
  const before = srcDyn.filter((d) => d.startBeat < from - EPS);
  const lastBefore = before.reduce<DynamicEvent | undefined>((p, d) => (!p || d.startBeat >= p.startBeat ? d : p), undefined);
  if (srcDyn.length && !here.some((d) => isLevelEv(d) && Math.abs(d.startBeat - from) < EPS)) {
    if (lastBefore && !isLevelEv(lastBefore)) {
      // 구간 앞에서 시작한 헤어핀이 시작 셈여림에 영향 → 앞 기호들을 음수 박으로 옮겨 보간값·남은 변화를 그대로 보존
      for (const d of before) {
        const copy = { ...d, startBeat: d.startBeat - from };
        if (!isLevelEv(d)) copyOf.set(copy, d);
        dynamics.push(copy);
      }
    } else {
      dynamics.push({ startBeat: 0, kind: levelAt(srcDyn, from) });
    }
  }
  for (const d of here) {
    const copy = { ...d, startBeat: d.startBeat - from };
    if (!isLevelEv(d)) copyOf.set(copy, d);
    dynamics.push(copy);
  }
  // 헤어핀 목표가 구간 밖 단계 기호였으면 헤어핀 끝에 원래 목표를 명시 (unrollScore 와 같은 보정)
  const origTargets = hairpinTargets(srcDyn);
  const outTargets = hairpinTargets(dynamics);
  const fixes: DynamicEvent[] = [];
  for (const [copy, orig] of copyOf) {
    const want = origTargets.get(orig);
    if (want && outTargets.get(copy) !== want) fixes.push({ startBeat: copy.startBeat + (copy.durationBeats ?? 0), kind: want });
  }
  const allDyn = fixes.length ? [...fixes, ...dynamics].sort((x, y) => x.startBeat - y.startBeat) : dynamics;

  return {
    ...base,
    notes,
    chords,
    dynamics: allDyn,
    totalBeats: to - from,
    range: r,
    cursor: buildCursor(notes),
  };
}

function cursorAt(plan: PlaybackPlan, beat: number): number {
  if (!(beat >= 0) || beat >= plan.totalBeats) return -1;
  let lo = 0;
  let hi = plan.cursor.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (plan.cursor[mid].beat <= beat + EPS) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** beat(계획 박) 에 커서를 둘 원본 score.notes 인덱스. 시작 박 ≤ beat 인 마지막 음(화음은 맨 위 음). 범위 밖이면 null */
export function noteIndexAtBeat(plan: PlaybackPlan, beat: number): number | null {
  const k = cursorAt(plan, beat);
  return k < 0 ? null : plan.cursor[k].noteIndex;
}

/** 일시정지 후 재개할 박 = beat 에서 소리 나던 음의 시작 박(멈춘 음부터). 범위 밖이면 0 */
export function resumeBeatAt(plan: PlaybackPlan, beat: number): number {
  const k = cursorAt(plan, beat);
  return k < 0 ? 0 : plan.cursor[k].beat;
}
