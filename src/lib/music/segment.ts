import { freqToMidiFloat, INSTRUMENT_MAX_FREQ, INSTRUMENT_MIN_FREQ, VOICE_MAX_FREQ, VOICE_MIN_FREQ } from "./frequency";
import type { PitchFrame, RawNote } from "./types";

export type PitchRange = "voice" | "instrument";

/** 검출 주파수 허용 범위. voice 65~1100Hz, instrument 27.5~4186Hz(A0~C8) */
export function rangeLimits(range: PitchRange): [number, number] {
  return range === "instrument" ? [INSTRUMENT_MIN_FREQ, INSTRUMENT_MAX_FREQ] : [VOICE_MIN_FREQ, VOICE_MAX_FREQ];
}

/** 악기 음색용 기본 신뢰도 (minClarity 를 직접 주지 않았을 때 range 별 기본값) */
export const INSTRUMENT_MIN_CLARITY = 0.92;

export interface SegmentOptions {
  /** 음역 필터. 기본 "voice". 단음(모노포닉) 전용 */
  range: PitchRange;
  /** 이 값 미만 신뢰도의 프레임은 무성으로 취급 */
  minClarity: number;
  /** 이보다 짧은 음은 잡음으로 보고 이웃 음에 흡수 (초) */
  minNoteSec: number;
  /** 이보다 짧은 무성 구간은 쉼표가 아니라 숨/자음으로 보고 무시 (초) */
  minRestSec: number;
  /** 이 이상 끊기면 같은 음이라도 새로 친 음으로 봄 (예: "솔 솔"의 자음 사이) (초) */
  articulationGapSec: number;
  /**
   * 또는 무성 프레임이 이 개수 이상 연속이면 새 음 (1프레임 끊김은 검출 잡음으로 무시).
   * 60fps 기준 프레임 수 — 실제 프레임 간격과 무관하게 같은 시간 폭(개수 × 1/60초)으로 환산
   */
  articulationFrames: number;
  /**
   * 히스테리시스: 무성 구간이라도 그 동안 주파수가 계속 같은 음 근처로 검출되고(신뢰도만 낮음)
   * 이 시간(초) 이내면 검출 드롭아웃으로 보고 한 음으로 유지. 주파수가 아예 없는 끊김은 반복음 분리 규칙을 따름
   */
  dropoutMaxSec: number;
  /**
   * 발성 시작 보정: 음이 시작되기 직전, 신뢰도만 낮고(softClarity 이상) 주파수는 이미 그 음 근처로 검출된
   * 무성 프레임을 음의 시작으로 되돌려 포함하는 최대 시간(초). 0 이면 끔
   */
  onsetBackfillSec: number;
  /** 발성 시작 보정에서 인정하는 최소 신뢰도 */
  softClarity: number;
  /** 같은 음으로 간주하는 허용 폭(반음). 0.6 = ±60센트 */
  hysteresis: number;
  /**
   * 중앙값 필터 창 크기(60fps 기준 프레임 수, 홀수) — 옥타브 튐/떨림 제거.
   * 실제 프레임 간격으로 환산해 같은 시간 폭으로 동작
   */
  medianWindow: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  range: "voice",
  minClarity: 0.88,
  minNoteSec: 0.06,
  minRestSec: 0.12,
  articulationGapSec: 0.03,
  articulationFrames: 2,
  dropoutMaxSec: 0.08,
  onsetBackfillSec: 0.12,
  softClarity: 0.7,
  hysteresis: 0.6,
  medianWindow: 5,
};

/** 프레임 개수 옵션의 기준 간격(60fps). 개수 × 이 값 = 시간 폭 */
export const REFERENCE_FRAME_SEC = 1 / 60;

/** 세기 온셋: 같은 음이 이어지는 중 직전 창(초) 안의 최저 세기 대비 이 비율 이상 커지면 새 음 */
export const ONSET_RATIO = 2;
/** 세기 온셋: 이 RMS 미만이면 온셋으로 보지 않음 (작은 잡음 요동 무시) */
export const ONSET_MIN_RMS = 0.01;
/** 세기 온셋: 골(최저 세기)을 찾는 직전 창 길이(초) */
export const ONSET_WINDOW_SEC = 0.08;

/** 시간 길이 비교 허용 오차(초) — 프레임 시각 부동소수 오차(예: 0.60-0.54=0.0599…)로 경계값이 뒤집히지 않게 */
const TIME_EPS = 1e-6;

/** 프레임 간격(초): 시간 차의 중앙값. 프레임이 1개 이하면 기준 간격 */
export function frameInterval(frames: PitchFrame[]): number {
  if (frames.length < 2) return REFERENCE_FRAME_SEC;
  const d: number[] = [];
  for (let i = 1; i < frames.length; i++) d.push(frames[i].time - frames[i - 1].time);
  const m = median(d);
  return m > 0 ? m : REFERENCE_FRAME_SEC;
}

/** 60fps 기준 프레임 개수 → 실제 간격에서의 개수 (최소 1) */
function scaledCount(count: number, frameSec: number): number {
  return Math.max(1, Math.round((count * REFERENCE_FRAME_SEC) / frameSec));
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 프레임별 실수 MIDI 값 (무성은 null) + 중앙값 필터 */
export function framesToPitchTrack(
  frames: PitchFrame[],
  opts: SegmentOptions,
  frameSec = frameInterval(frames),
): (number | null)[] {
  const [fMin, fMax] = rangeLimits(opts.range ?? "voice");
  const raw = frames.map((f) =>
    f.freq !== null && f.clarity >= opts.minClarity && f.freq >= fMin && f.freq <= fMax
      ? freqToMidiFloat(f.freq)
      : null,
  );
  const half = Math.round((Math.floor(opts.medianWindow / 2) * REFERENCE_FRAME_SEC) / frameSec);
  return raw.map((v, i) => {
    if (v === null) return null;
    const win: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(raw.length - 1, i + half); j++) {
      const w = raw[j];
      if (w !== null) win.push(w);
    }
    return win.length ? median(win) : v;
  });
}

interface Building {
  values: number[];
  start: number;
  end: number;
}

function finish(b: Building): RawNote {
  const m = median(b.values);
  const midi = Math.round(m);
  const meanCents = (b.values.reduce((s, v) => s + (v - midi), 0) / b.values.length) * 100;
  return { midi, startSec: b.start, endSec: b.end, meanCents };
}

/**
 * 피치 프레임 → 음 구간(초 단위).
 * 프레임은 시간순, 대략 일정 간격이라고 가정합니다.
 */
export function segmentFrames(frames: PitchFrame[], options: Partial<SegmentOptions> = {}): RawNote[] {
  const opts = { ...DEFAULT_SEGMENT_OPTIONS, ...options };
  if (options.range === "instrument" && options.minClarity === undefined) opts.minClarity = INSTRUMENT_MIN_CLARITY;
  const [fMin, fMax] = rangeLimits(opts.range);
  if (frames.length === 0) return [];
  const frameDur = frameInterval(frames);
  const track = framesToPitchTrack(frames, opts, frameDur);
  /** 현재 음의 기준 음높이를 잡는 최근 프레임 수 (60fps 8프레임 ≈ 0.13초) */
  const refCount = scaledCount(8, frameDur);
  const articulationSec = opts.articulationFrames * REFERENCE_FRAME_SEC;
  /** 세기 온셋으로 시작된 음 — 끊김 없이 이어져도 병합하지 않음 */
  const onsetNotes = new Set<RawNote>();
  let curStartIdx = 0;

  const notes: RawNote[] = [];
  let cur: Building | null = null;
  let silenceStart: number | null = null;
  let silentFrames = 0;
  let silentSoftOk = true; // 무성 구간 동안 주파수는 계속 현재 음 근처였는가

  let curByOnset = false;
  const close = (endTime: number) => {
    if (!cur) return;
    cur.end = endTime;
    const n = finish(cur);
    if (curByOnset) onsetNotes.add(n);
    notes.push(n);
    cur = null;
    curByOnset = false;
  };

  /**
   * 세기 온셋: 현재 음 안에서 직전 창의 골(최저 RMS) 대비 i 프레임 세기가 ONSET_RATIO 배 이상이고,
   * 골 이전에 이미 그만큼 컸던 적이 있으면(=소리가 줄었다 다시 커짐) 새로 친 음. 발성 시작의 상승 구간은 제외됨
   */
  const isOnset = (i: number): boolean => {
    const r = frames[i].rms;
    if (r === undefined || r < ONSET_MIN_RMS) return false;
    let minR = Infinity;
    let k = -1;
    for (let j = i - 1; j >= curStartIdx && frames[i].time - frames[j].time <= ONSET_WINDOW_SEC + 1e-9; j--) {
      // 창 안에 무성 프레임이 있으면 그 끊김은 드롭아웃·반복음 규칙(무성 구간)이 판정 — 온셋은 유성이 이어지는 중의 세기 골만
      if (track[j] === null) return false;
      const rj = frames[j].rms;
      if (rj === undefined) return false;
      if (rj < minR) {
        minR = rj;
        k = j;
      }
    }
    if (k < 0 || r < ONSET_RATIO * minR) return false;
    for (let j = curStartIdx; j < k; j++) {
      const rj = frames[j].rms;
      if (rj !== undefined && rj >= ONSET_RATIO * minR) return true;
    }
    return false;
  };

  /** 새 음의 시작 시각: 바로 앞의 '약한 발성' 프레임(주파수는 이 음 근처, 신뢰도만 낮음)까지 되돌림 */
  const backfillStart = (i: number, v: number): number => {
    let start = frames[i].time;
    const floor = notes.length ? notes[notes.length - 1].endSec : -Infinity;
    for (let j = i - 1; j >= 0 && frames[i].time - frames[j].time <= opts.onsetBackfillSec + 1e-9; j--) {
      const f = frames[j];
      if (track[j] !== null || f.freq === null || f.clarity < opts.softClarity) break;
      if (f.freq < fMin || f.freq > fMax || Math.abs(freqToMidiFloat(f.freq) - v) > opts.hysteresis) break;
      if (f.time < floor - 1e-9) break;
      start = f.time;
    }
    return start;
  };

  for (let i = 0; i < frames.length; i++) {
    const t = frames[i].time;
    const v = track[i];
    if (v === null) {
      if (silenceStart === null) {
        silenceStart = t;
        silentSoftOk = true;
      }
      silentFrames++;
      const f = frames[i];
      const refv = cur ? median((cur as Building).values.slice(-refCount)) : null;
      if (
        refv === null || f.freq === null || f.freq < fMin || f.freq > fMax ||
        Math.abs(freqToMidiFloat(f.freq) - refv) > opts.hysteresis
      ) silentSoftOk = false;
      continue;
    }
    // 무성 구간이 끝난 시점에 길이를 판정: 충분히 끊겼으면 같은 음이라도 새 음
    const isDropout = silentSoftOk && t - (silenceStart ?? t) <= opts.dropoutMaxSec + TIME_EPS;
    if (silenceStart !== null && cur && !isDropout && (t - silenceStart >= opts.articulationGapSec - TIME_EPS || silentFrames * frameDur >= articulationSec - TIME_EPS)) {
      close(silenceStart);
    }
    silenceStart = null;
    silentFrames = 0;
    if (cur) {
      const ref = median(cur.values.slice(-refCount));
      if (Math.abs(v - ref) <= opts.hysteresis) {
        if (isOnset(i)) {
          close(t);
          cur = { values: [v], start: t, end: t + frameDur };
          curStartIdx = i;
          curByOnset = true;
          continue;
        }
        cur.values.push(v);
        cur.end = t + frameDur;
        continue;
      }
      close(t);
    }
    cur = { values: [v], start: backfillStart(i, v), end: t + frameDur };
    curStartIdx = i;
  }
  if (cur) close((cur as Building).end);

  // 너무 짧은 음 → 앞 음(없으면 뒤 음)에 흡수
  const cleaned: RawNote[] = [];
  const keepSplit = new Set<RawNote>();
  for (const n of notes) {
    if (n.endSec - n.startSec >= opts.minNoteSec - TIME_EPS) {
      const c = { ...n };
      if (onsetNotes.has(n)) keepSplit.add(c);
      cleaned.push(c);
      continue;
    }
    const prev = cleaned[cleaned.length - 1];
    if (prev && n.startSec - prev.endSec < opts.minRestSec - TIME_EPS) prev.endSec = n.endSec;
  }

  // 같은 음이 끊김 없이 둘로 나뉜 경우만 병합 (짧은 흡수 결과 등).
  // 끊김이 있었던 같은 음("솔 솔")은 반복음이므로 그대로 둡니다.
  const merged: RawNote[] = [];
  for (const n of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midi === n.midi && n.startSec - prev.endSec <= 1e-3 && !keepSplit.has(n)) {
      prev.endSec = n.endSec;
    } else merged.push(n);
  }
  return merged;
}
