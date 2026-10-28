import type { PitchFrame } from "./types";

/**
 * 목소리 / 악기 판별 — 피치 프레임만으로 판단(오디오 원본 불필요).
 * 목소리는 음정이 끊임없이 흔들리고(비브라토 4~8Hz·지터), 음 시작에 미끄러져 들어가며(글라이드),
 * 자음 때문에 짧은 무성 구간이 끼어든다. 악기(건반 등)는 음정이 거의 고정이다.
 */

/** 비브라토로 보는 떨림 빠르기(Hz) */
export const VOICE_VIBRATO_MIN_HZ = 4;
export const VOICE_VIBRATO_MAX_HZ = 8;
/** 비브라토로 인정하는 최소 폭(센트, 진폭) */
export const VOICE_VIBRATO_MIN_CENTS = 10;
/** 비브라토 판정 자기상관 문턱 */
export const VOICE_VIBRATO_MIN_CORR = 0.3;
/** 국소 중앙값 창(초) — 음 높이 추세를 빼서 떨림만 남김 */
export const VOICE_TREND_WINDOW_SEC = 0.3;
/** 이 RMS 흔들림(센트)이면 지터 점수 만점 */
export const VOICE_JITTER_FULL_CENTS = 15;
/** 음 시작 글라이드 검사 구간(초)과 판정 편차(센트) */
export const VOICE_GLIDE_WINDOW_SEC = 0.08;
export const VOICE_GLIDE_MIN_CENTS = 40;
/** 무성 비율 이 값이면 무성 점수 만점 */
export const VOICE_UNVOICED_FULL_RATIO = 0.2;
/** 이 길이(초) 이상의 무음이면 다른 구간으로 나눔 (짧은 자음 끊김은 같은 구간) */
export const VOICE_SEGMENT_GAP_SEC = 0.25;
/** 특징별 가중치 (합 1) */
export const VOICE_WEIGHTS = { vibrato: 0.35, jitter: 0.3, glide: 0.2, unvoiced: 0.15 } as const;
/** 점수가 이 값 이상이면 목소리 */
export const VOICE_THRESHOLD = 0.5;

export interface VoiceFeatures {
  /** 4~8Hz 자기상관 최대값(폭 미달이면 0), 0~1 */
  vibrato: number;
  /** 국소 중앙값 대비 RMS 음정 흔들림(센트) */
  jitterCents: number;
  /** 음 시작이 글라이드인 유성 구간 비율, 0~1 */
  glideRatio: number;
  /** 첫 유성~끝 유성 사이 무성 프레임 비율, 0~1 */
  unvoicedRatio: number;
}

export interface VoiceClassification {
  label: "voice" | "instrument";
  /** 0(악기) ~ 1(목소리) */
  score: number;
  features: VoiceFeatures;
}

const cents = (f: number) => 1200 * Math.log2(f / 440);

/** 프레임 간격(초): 시간 차의 중앙값, 모르면 1/60 */
function frameInterval(frames: PitchFrame[]): number {
  const d = frames.slice(1).map((f, i) => f.time - frames[i].time).filter((x) => x > 0).sort((a, b) => a - b);
  return d.length ? d[d.length >> 1] : 1 / 60;
}

/** 연속 유성 프레임 구간(센트 배열) */
function voicedRuns(frames: PitchFrame[]): number[][] {
  const runs: number[][] = [];
  let cur: number[] = [];
  for (const f of frames) {
    if (f.freq !== null && f.freq > 0) cur.push(cents(f.freq));
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

/** 중심 이동 중앙값을 뺀 편차 (중앙값이라 음이 바뀌는 계단에서 튀지 않음) */
function detrend(run: number[], half: number): number[] {
  return run.map((v, i) => {
    const w = run.slice(Math.max(0, i - half), i + half + 1).sort((a, b) => a - b);
    return v - w[w.length >> 1];
  });
}

/** 정규화 자기상관의 lag 범위 최대값 */
function maxAutocorr(x: number[], minLag: number, maxLag: number): number {
  const e = x.reduce((s, v) => s + v * v, 0);
  if (e <= 0) return 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag && lag < x.length; lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    best = Math.max(best, s / e);
  }
  return best;
}

export function classifyVoiceSegment(frames: PitchFrame[], frameSec = frameInterval(frames)): VoiceClassification {
  const runs = voicedRuns(frames);
  const half = Math.max(1, Math.round(VOICE_TREND_WINDOW_SEC / frameSec / 2));
  const minLag = Math.max(1, Math.round(1 / VOICE_VIBRATO_MAX_HZ / frameSec));
  const maxLag = Math.round(1 / VOICE_VIBRATO_MIN_HZ / frameSec);
  const glideN = Math.max(1, Math.round(VOICE_GLIDE_WINDOW_SEC / frameSec));

  let sq = 0;
  let n = 0;
  let vibrato = 0;
  let glides = 0;
  let glideRuns = 0;
  for (const run of runs) {
    const dev = detrend(run, half);
    sq += dev.reduce((s, v) => s + v * v, 0);
    n += dev.length;
    // 비브라토: 한 주기 이상 길이의 구간에서, 폭이 충분할 때만
    if (run.length > maxLag * 2) {
      const amp = Math.sqrt((2 * dev.reduce((s, v) => s + v * v, 0)) / dev.length);
      if (amp >= VOICE_VIBRATO_MIN_CENTS) vibrato = Math.max(vibrato, maxAutocorr(dev, minLag, maxLag));
    }
    // 글라이드: 시작 구간 평균이 바로 뒤 안정 구간 중앙값에서 크게 벗어남
    if (run.length >= glideN * 3) {
      glideRuns++;
      const sorted = run.slice(glideN, glideN * 3).sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      const head = run.slice(0, glideN).reduce((s, v) => s + v, 0) / glideN;
      if (Math.abs(head - median) >= VOICE_GLIDE_MIN_CENTS) glides++;
    }
  }
  const jitterCents = n ? Math.sqrt(sq / n) : 0;
  const glideRatio = glideRuns ? glides / glideRuns : 0;

  const voiced = frames.map((f) => f.freq !== null && f.freq > 0);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  const span = first < 0 ? 0 : last - first + 1;
  const unvoicedRatio = span ? voiced.slice(first, last + 1).filter((v) => !v).length / span : 0;

  const features: VoiceFeatures = { vibrato: Math.min(1, Math.max(0, vibrato)), jitterCents, glideRatio, unvoicedRatio };
  const w = VOICE_WEIGHTS;
  const score =
    w.vibrato * features.vibrato +
    w.jitter * Math.min(1, jitterCents / VOICE_JITTER_FULL_CENTS) +
    w.glide * glideRatio +
    w.unvoiced * Math.min(1, unvoicedRatio / VOICE_UNVOICED_FULL_RATIO);
  return { label: score >= VOICE_THRESHOLD ? "voice" : "instrument", score, features };
}

/**
 * 긴 무음(VOICE_SEGMENT_GAP_SEC 이상)으로 구간을 나눠 각각 판별하고,
 * 목소리로 보이는 구간의 프레임은 무음(freq null, clarity 0)으로 바꾼 새 배열을 돌려준다. 원본 불변.
 */
export function filterInstrumentFrames(frames: PitchFrame[], frameSec = frameInterval(frames)): PitchFrame[] {
  const gapN = Math.max(1, Math.round(VOICE_SEGMENT_GAP_SEC / frameSec));
  const out = frames.slice();
  let start = -1; // 현재 구간 첫 유성 프레임
  let lastVoiced = -1;
  const flush = () => {
    if (start < 0) return;
    const seg = frames.slice(start, lastVoiced + 1);
    if (classifyVoiceSegment(seg, frameSec).label === "voice") {
      for (let i = start; i <= lastVoiced; i++) out[i] = { ...frames[i], freq: null, clarity: 0 };
    }
    start = -1;
  };
  frames.forEach((f, i) => {
    if (f.freq === null || f.freq <= 0) return;
    if (start >= 0 && i - lastVoiced > gapN) flush();
    if (start < 0) start = i;
    lastVoiced = i;
  });
  flush();
  return out;
}
