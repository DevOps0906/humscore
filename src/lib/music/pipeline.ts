import { quantizeNotes, measureCount } from "./quantize";
import { segmentFrames, type SegmentOptions } from "./segment";
import { estimateKey, suggestChords } from "./theory";
import type { PitchFrame, RawNote, Score } from "./types";

export interface BuildScoreOptions {
  title?: string;
  bpm: number;
  beatsPerMeasure: number;
  grid?: number;
  segment?: Partial<SegmentOptions>;
}

export interface BuildScoreResult {
  score: Score;
  raw: RawNote[];
  /** 음별 평균 음정 오차의 절댓값 평균(센트) — 음정 코칭 점수 */
  meanAbsCents: number;
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 허밍 채보 파이프라인 (전부 기기 안에서 실행, 서버 비용 0)
 *   피치 프레임 → 음 구간 → 박자 정렬 → 조성 추정 → 코드 추천 → Score
 */
export function buildScoreFromFrames(frames: PitchFrame[], opts: BuildScoreOptions): BuildScoreResult {
  const raw = segmentFrames(frames, opts.segment);
  const notes = quantizeNotes(raw, { bpm: opts.bpm, beatsPerMeasure: opts.beatsPerMeasure, grid: opts.grid ?? 0.5 });
  const key = estimateKey(notes);
  const measures = measureCount(notes, opts.beatsPerMeasure);
  const chords = suggestChords(notes, key, opts.beatsPerMeasure, measures);
  const sung = raw.filter((r) => r.midi !== null);
  const meanAbsCents = sung.length ? sung.reduce((s, r) => s + Math.abs(r.meanCents), 0) / sung.length : 0;
  const now = new Date().toISOString();

  return {
    raw,
    meanAbsCents,
    score: {
      id: newId(),
      title: opts.title ?? `허밍 ${new Date().toLocaleString("ko-KR")}`,
      bpm: opts.bpm,
      beatsPerMeasure: opts.beatsPerMeasure,
      beatUnit: 4,
      key,
      notes,
      chords,
      transpose: 0,
      createdAt: now,
      updatedAt: now,
    },
  };
}
