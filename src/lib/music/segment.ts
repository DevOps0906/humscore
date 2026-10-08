import { freqToMidiFloat, VOICE_MAX_FREQ, VOICE_MIN_FREQ } from "./frequency";
import type { PitchFrame, RawNote } from "./types";

export interface SegmentOptions {
  /** 이 값 미만 신뢰도의 프레임은 무성으로 취급 */
  minClarity: number;
  /** 이보다 짧은 음은 잡음으로 보고 이웃 음에 흡수 (초) */
  minNoteSec: number;
  /** 이보다 짧은 무성 구간은 쉼표가 아니라 숨/자음으로 보고 무시 (초) */
  minRestSec: number;
  /** 이 이상 끊기면 같은 음이라도 새로 친 음으로 봄 (예: "솔 솔"의 자음 사이) (초) */
  articulationGapSec: number;
  /** 또는 무성 프레임이 이 개수 이상 연속이면 새 음 (1프레임 끊김은 검출 잡음으로 무시) */
  articulationFrames: number;
  /** 같은 음으로 간주하는 허용 폭(반음). 0.6 = ±60센트 */
  hysteresis: number;
  /** 중앙값 필터 창 크기(프레임 수, 홀수) — 옥타브 튐/떨림 제거 */
  medianWindow: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  minClarity: 0.88,
  minNoteSec: 0.09,
  minRestSec: 0.12,
  articulationGapSec: 0.03,
  articulationFrames: 2,
  hysteresis: 0.6,
  medianWindow: 5,
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 프레임별 실수 MIDI 값 (무성은 null) + 중앙값 필터 */
export function framesToPitchTrack(frames: PitchFrame[], opts: SegmentOptions): (number | null)[] {
  const raw = frames.map((f) =>
    f.freq !== null && f.clarity >= opts.minClarity && f.freq >= VOICE_MIN_FREQ && f.freq <= VOICE_MAX_FREQ
      ? freqToMidiFloat(f.freq)
      : null,
  );
  const half = Math.floor(opts.medianWindow / 2);
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
  if (frames.length === 0) return [];
  const track = framesToPitchTrack(frames, opts);
  const frameDur = frames.length > 1 ? (frames[frames.length - 1].time - frames[0].time) / (frames.length - 1) : 0.01;

  const notes: RawNote[] = [];
  let cur: Building | null = null;
  let silenceStart: number | null = null;
  let silentFrames = 0;

  const close = (endTime: number) => {
    if (!cur) return;
    cur.end = endTime;
    notes.push(finish(cur));
    cur = null;
  };

  for (let i = 0; i < frames.length; i++) {
    const t = frames[i].time;
    const v = track[i];
    if (v === null) {
      if (silenceStart === null) silenceStart = t;
      silentFrames++;
      continue;
    }
    // 무성 구간이 끝난 시점에 길이를 판정: 충분히 끊겼으면 같은 음이라도 새 음
    if (silenceStart !== null && cur && (t - silenceStart >= opts.articulationGapSec || silentFrames >= opts.articulationFrames)) {
      close(silenceStart);
    }
    silenceStart = null;
    silentFrames = 0;
    if (cur) {
      const ref = median(cur.values.slice(-8));
      if (Math.abs(v - ref) <= opts.hysteresis) {
        cur.values.push(v);
        cur.end = t + frameDur;
        continue;
      }
      close(t);
    }
    cur = { values: [v], start: t, end: t + frameDur };
  }
  if (cur) close((cur as Building).end);

  // 너무 짧은 음 → 앞 음(없으면 뒤 음)에 흡수
  const cleaned: RawNote[] = [];
  for (const n of notes) {
    if (n.endSec - n.startSec >= opts.minNoteSec) {
      cleaned.push({ ...n });
      continue;
    }
    const prev = cleaned[cleaned.length - 1];
    if (prev && n.startSec - prev.endSec < opts.minRestSec) prev.endSec = n.endSec;
  }

  // 같은 음이 끊김 없이 둘로 나뉜 경우만 병합 (짧은 흡수 결과 등).
  // 끊김이 있었던 같은 음("솔 솔")은 반복음이므로 그대로 둡니다.
  const merged: RawNote[] = [];
  for (const n of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && prev.midi === n.midi && n.startSec - prev.endSec <= 1e-3) {
      prev.endSec = n.endSec;
    } else merged.push(n);
  }
  return merged;
}
