/** 따라 치기(기다리기 모드) 판정 — 순수 함수. 상태는 불변, 시간은 인자로 받는다. */
import { centsOff, freqToNearestMidi, pitchClass } from "./frequency";
import { measureOf, scoreMeasureCount } from "./edit";
import { measureOrder } from "./form";
import type { Score } from "./types";

/** 판정 상수 — 실기기 실측(task-010-d) 후 조정할 수 있도록 export */
export const FOLLOW_CENTS_TOLERANCE = 50;
export const FOLLOW_MIN_CLARITY = 0.92;
/** 같은 음이 연속으로 이 시간(초)만큼 유지돼야 확정 (60fps 3프레임) */
export const FOLLOW_STABLE_SEC = 3 / 60;
/** 같은 음 재판정을 위한 무음 시간(초) (60fps 5프레임) */
export const FOLLOW_RELEASE_SILENT_SEC = 5 / 60;
/** 프레임 한 개가 차지하는 최대 시간(ms). 간격 0 이하(시각 정보 없음)일 때도 이 값. 늦게 온 프레임이 확정을 앞당기지 않도록 상한 */
const FOLLOW_FRAME_MAX_MS = 1000 / 60;
/** 세션 첫 프레임의 시간(ms): 간격을 모르므로 가장 촘촘한 지원 간격(100fps) */
const FOLLOW_FIRST_FRAME_MS = 10;
/** 누적 시간 비교 허용 오차(ms) = 60fps 반 프레임 — 가장 가까운 프레임 수로 반올림하는 효과, 간격 흔들림 흡수 */
const FOLLOW_TIME_TOLERANCE_MS = FOLLOW_FRAME_MAX_MS / 2;
/** 확정 뒤 최저 rms 대비 이 배수 이상으로 오르면 재타건으로 본다 */
export const FOLLOW_RMS_RISE_RATIO = 1.5;
/** 재상승으로 인정할 최소 rms */
export const FOLLOW_RMS_RISE_MIN = 0.01;

export type FollowInput =
  | {
      kind: "frame";
      freq: number | null;
      clarity: number;
      rms?: number;
      /** 프레임 시각(초, PitchFrame.time). 있으면 nowMs 대신 이 값으로 경과 시간을 잰다 */
      time?: number;
    }
  | { kind: "midi"; midi: number };

export interface FollowState {
  /** 펼친 순서의 목표 MIDI (전조 적용, 쉼표 제외) */
  readonly targets: readonly number[];
  readonly index: number;
  readonly wrongCount: number;
  readonly startedAtMs: number;
  /** 끝까지 맞춘 시각. 아직이면 null */
  readonly finishedAtMs: number | null;
  readonly candidate: number | null;
  /** 후보 음이 연속으로 유지된 시간(ms) */
  readonly candidateMs: number;
  /** 직전 확정 음. 놓기(무음/재상승) 전엔 같은 음을 다시 판정하지 않는다 */
  readonly lockedMidi: number | null;
  /** 연속 무음 시간(ms) */
  readonly silentMs: number;
  readonly lockMinRms: number;
  /** 직전 프레임 시각(ms). 프레임 간격 측정용 */
  readonly lastFrameMs: number | null;
}

export type FollowResultKind = "none" | "correct" | "wrong" | "octave" | "done";

export interface FollowResult {
  kind: FollowResultKind;
  /** 확정된 입력 음 (kind 가 none/done 이면 null) */
  heard: number | null;
  /** 판정에 쓰인 목표 음 (끝났으면 null) */
  target: number | null;
  /** 이번 입력으로 끝까지 맞췄는가 */
  finished: boolean;
  wrongCount: number;
  startedAtMs: number;
  finishedAtMs: number | null;
}

const EPS = 1e-6;
/** 잠금 중 배음으로 보고 무시할 반음 거리 (옥타브·옥타브+5도·2옥타브) */
const HARMONIC_DIFFS = [12, 19, 24];

export interface FollowPlan {
  /** 펼친 순서의 목표 MIDI (전조 적용, 쉼표 제외) */
  targets: number[];
  /** targets[i] 에 해당하는 원본 score.notes 인덱스 (맨 위 음) */
  noteIndexes: number[];
  /** 같은 시작 박에 소리 나는 음이 둘 이상인 곳이 있는가 */
  hasChord: boolean;
}

/** 펼친 순서의 목표·원본 음표 인덱스. 쉼표 제외, 전조 적용, 같은 시작 시각 음은 맨 위 음만 */
export function buildFollowPlan(score: Score): FollowPlan {
  const bpm = score.beatsPerMeasure;
  const total = scoreMeasureCount(score);
  const entries: { start: number; midi: number | null; src: number }[] = [];
  measureOrder(score).forEach((m, k) => {
    const shift = (k - m) * bpm;
    score.notes.forEach((n, src) => {
      if (Math.min(total - 1, measureOf(n.startBeat, bpm)) !== m) return;
      entries.push({ start: n.startBeat + shift, midi: n.midi, src });
    });
  });
  entries.sort((a, b) => a.start - b.start);
  const targets: number[] = [];
  const noteIndexes: number[] = [];
  let hasChord = false;
  let i = 0;
  while (i < entries.length) {
    let j = i;
    let top: number | null = null;
    let topSrc = -1;
    let sounding = 0;
    while (j < entries.length && Math.abs(entries[j].start - entries[i].start) < EPS) {
      const m = entries[j].midi;
      if (m !== null) {
        sounding++;
        if (top === null || m > top) {
          top = m;
          topSrc = entries[j].src;
        }
      }
      j++;
    }
    if (sounding > 1) hasChord = true;
    if (top !== null) {
      targets.push(top + score.transpose);
      noteIndexes.push(topSrc);
    }
    i = j;
  }
  return { targets, noteIndexes, hasChord };
}

/** 펼친 순서의 목표 MIDI 목록 */
export function buildTargets(score: Score): number[] {
  return buildFollowPlan(score).targets;
}

export function createFollowState(targets: readonly number[], nowMs: number): FollowState {
  return {
    targets,
    index: 0,
    wrongCount: 0,
    startedAtMs: nowMs,
    finishedAtMs: null,
    candidate: null,
    candidateMs: 0,
    lockedMidi: null,
    silentMs: 0,
    lockMinRms: Infinity,
    lastFrameMs: null,
  };
}

/** 처음부터 다시 */
export function resetFollow(state: FollowState, nowMs: number): FollowState {
  return createFollowState(state.targets, nowMs);
}

export function isFollowDone(state: FollowState): boolean {
  return state.index >= state.targets.length;
}

function result(
  state: FollowState,
  kind: FollowResultKind,
  heard: number | null,
  target: number | null,
  finished = false,
): FollowResult {
  return {
    kind,
    heard,
    target,
    finished,
    wrongCount: state.wrongCount,
    startedAtMs: state.startedAtMs,
    finishedAtMs: state.finishedAtMs,
  };
}

/** 확정된 음 하나를 목표와 비교 */
function decide(state: FollowState, heard: number, nowMs: number): { state: FollowState; result: FollowResult } {
  const target = state.targets[state.index];
  if (heard === target) {
    const index = state.index + 1;
    const finished = index >= state.targets.length;
    const next = { ...state, index, finishedAtMs: finished ? nowMs : null };
    return { state: next, result: result(next, "correct", heard, target, finished) };
  }
  const octave = pitchClass(heard) === pitchClass(target);
  const next = { ...state, wrongCount: state.wrongCount + 1 };
  return { state: next, result: result(next, octave ? "octave" : "wrong", heard, target) };
}

export function judge(
  state: FollowState,
  input: FollowInput,
  nowMs: number,
): { state: FollowState; result: FollowResult } {
  if (isFollowDone(state)) return { state, result: result(state, "done", null, null) };

  if (input.kind === "midi") return decide(state, input.midi, nowMs);

  const rms = input.rms;
  const tMs = input.time !== undefined ? input.time * 1000 : nowMs;
  const dt = state.lastFrameMs === null ? null : tMs - state.lastFrameMs;
  /** 이번 프레임이 차지하는 시간(ms): 직전 프레임과의 간격, 단 (0, 1/60초] 밖이면 1/60초 */
  const frameMs = dt === null ? FOLLOW_FIRST_FRAME_MS : dt > 0 ? Math.min(dt, FOLLOW_FRAME_MAX_MS) : FOLLOW_FRAME_MAX_MS;
  state = { ...state, lastFrameMs: tMs };
  const pitched =
    input.freq !== null &&
    input.freq > 0 &&
    input.clarity >= FOLLOW_MIN_CLARITY &&
    Math.abs(centsOff(input.freq)) <= FOLLOW_CENTS_TOLERANCE;

  if (!pitched) {
    const silentMs = state.silentMs + frameMs;
    const released =
      state.lockedMidi !== null && silentMs >= FOLLOW_RELEASE_SILENT_SEC * 1000 - FOLLOW_TIME_TOLERANCE_MS;
    const next: FollowState = {
      ...state,
      candidate: null,
      candidateMs: 0,
      silentMs,
      lockedMidi: released ? null : state.lockedMidi,
      lockMinRms: released ? Infinity : state.lockMinRms,
    };
    return { state: next, result: result(next, "none", null, state.targets[state.index]) };
  }

  const midi = freqToNearestMidi(input.freq as number);
  let { lockedMidi, lockMinRms } = state;
  if (lockedMidi !== null) {
    const diff = Math.abs(midi - lockedMidi);
    if (midi !== lockedMidi && HARMONIC_DIFFS.includes(diff)) {
      // 피아노 감쇠 중 배음(옥타브·12도·2옥타브) — 잠금 유지, 무시
      const next = { ...state, candidate: null, candidateMs: 0, silentMs: 0 };
      return { state: next, result: result(next, "none", null, state.targets[state.index]) };
    }
    if (midi !== lockedMidi) {
      lockedMidi = null;
      lockMinRms = Infinity;
    } else {
      const risen =
        rms !== undefined &&
        rms >= FOLLOW_RMS_RISE_MIN &&
        Number.isFinite(lockMinRms) &&
        rms >= lockMinRms * FOLLOW_RMS_RISE_RATIO;
      if (risen) {
        lockedMidi = null;
        lockMinRms = Infinity;
      } else {
        const next = {
          ...state,
          candidate: null,
          candidateMs: 0,
          silentMs: 0,
          lockMinRms: rms !== undefined ? Math.min(lockMinRms, rms) : lockMinRms,
        };
        return { state: next, result: result(next, "none", null, state.targets[state.index]) };
      }
    }
  }

  const heldMs = (state.candidate === midi ? state.candidateMs : 0) + frameMs;
  const base: FollowState = { ...state, lockedMidi, lockMinRms, silentMs: 0 };
  if (heldMs < FOLLOW_STABLE_SEC * 1000 - FOLLOW_TIME_TOLERANCE_MS) {
    const next = { ...base, candidate: midi, candidateMs: heldMs };
    return { state: next, result: result(next, "none", null, state.targets[state.index]) };
  }
  const decided = decide(
    { ...base, candidate: null, candidateMs: 0, lockedMidi: midi, lockMinRms: rms ?? Infinity },
    midi,
    nowMs,
  );
  return decided;
}
