import { durationLabel } from "../music/meter";
import { MIC_TIMING, quantizeNotes, type QuantizeTiming } from "../music/quantize";
import { segmentFrames, type PitchRange } from "../music/segment";
import type { PitchFrame, RawNote } from "../music/types";

/** 녹음 중 악보 미리보기용 순수 함수 (피치 숫자만 사용, 오디오 없음) */

export interface LiveChip {
  key: string;
  /** 1부터 시작하는 마디 번호 */
  measure: number;
  midi: number | null;
  startBeat: number;
  durationBeats: number;
  /** 한국어 계이름 ("도", "파#") 또는 "쉼" */
  name: string;
  /** 음가 이름 ("2분", "점4분") */
  duration: string;
  /** "도 · 2분" */
  text: string;
}

export interface LiveMeasure {
  measure: number;
  chips: LiveChip[];
}

export interface LiveActive {
  midi: number;
  name: string;
  /** 현재까지 길이(박, 0.25 격자) */
  durationBeats: number;
  duration: string;
  text: string;
}

export interface LiveSummary {
  /** 마지막 maxMeasures 마디만 */
  measures: LiveMeasure[];
  active: LiveActive | null;
  /** 전체 확정 마디 수 (스크린리더 요약용) */
  totalMeasures: number;
  /** 확정된 음표(쉼표 제외) 개수 */
  noteCount: number;
}

export interface LiveOptions {
  bpm: number;
  /** 4분음표 박 수 (6/8 도 3) */
  beatsPerMeasure: number;
  range?: PitchRange;
  /** 보여줄 마지막 마디 수 */
  maxMeasures?: number;
  /** 마이크 경로는 MIC_TIMING(기본), MIDI 건반은 null */
  timing?: QuantizeTiming | null;
}

const SOLFEGE = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
const EPS = 1e-6;
/** 마지막 프레임과 음 끝이 이 이내면 아직 소리 나는 중 */
export const ACTIVE_TOLERANCE_SEC = 0.15;

/** 한국어 계이름 (옥타브 없음) */
export function solfegeName(midi: number): string {
  return SOLFEGE[((midi % 12) + 12) % 12];
}

function snapUp(beats: number, grid = 0.25): number {
  return Math.max(grid, Math.round(beats / grid) * grid);
}

/**
 * 음 구간(초) → 칩 목록. nowSec: 지금 시각(녹음 기준 초), 마지막 음이 nowSec 근처에서 끝나면 진행 중으로 본다.
 * activeTolSec 를 0 이하로 주면 진행 중 음 없음.
 */
export function liveSummaryFromRaw(
  raw: RawNote[],
  nowSec: number,
  opts: LiveOptions & { activeTolSec?: number },
): LiveSummary {
  const spb = 60 / opts.bpm;
  const bpm4 = opts.beatsPerMeasure;
  const tol = opts.activeTolSec ?? ACTIVE_TOLERANCE_SEC;
  const maxMeasures = opts.maxMeasures ?? 4;
  const sorted = raw.filter((n) => n.midi !== null);

  let active: LiveActive | null = null;
  let done = sorted;
  const last = sorted[sorted.length - 1];
  if (last && tol > 0 && nowSec - last.endSec <= tol) {
    done = sorted.slice(0, -1);
    const durationBeats = snapUp((nowSec > last.endSec ? nowSec : last.endSec) / spb - last.startSec / spb);
    const name = solfegeName(last.midi!);
    const duration = durationLabel(durationBeats);
    active = { midi: last.midi!, name, durationBeats, duration, text: `${name} · ${duration} (진행 중)` };
  }

  const timing = opts.timing === undefined ? MIC_TIMING : opts.timing;
  let notes = done.length
    ? quantizeNotes(done, { bpm: opts.bpm, beatsPerMeasure: bpm4, grid: 0.25, timing })
    : [];
  // 마지막 마디를 채우는 꼬리 쉼표는 아직 연주되지 않은 부분이므로 뺀다
  while (notes.length && notes[notes.length - 1].midi === null) notes = notes.slice(0, -1);

  const chips: LiveChip[] = notes.map((n, i) => {
    const measure = Math.floor((n.startBeat + EPS) / bpm4) + 1;
    const name = n.midi === null ? "쉼" : solfegeName(n.midi);
    const duration = durationLabel(n.durationBeats);
    return {
      key: `${i}-${n.startBeat}-${n.midi}`,
      measure,
      midi: n.midi,
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      name,
      duration,
      text: `${name} · ${duration}`,
    };
  });

  const groups: LiveMeasure[] = [];
  for (const c of chips) {
    const g = groups[groups.length - 1];
    if (g && g.measure === c.measure) g.chips.push(c);
    else groups.push({ measure: c.measure, chips: [c] });
  }
  return {
    measures: groups.slice(-maxMeasures),
    active,
    totalMeasures: groups.length ? groups[groups.length - 1].measure : 0,
    noteCount: chips.filter((c) => c.midi !== null).length,
  };
}

/** 마이크 피치 프레임 → 칩 목록 (최종 악보와 같은 segment/quantize 설정) */
export function liveSummaryFromFrames(frames: PitchFrame[], opts: LiveOptions): LiveSummary {
  if (frames.length === 0) return { measures: [], active: null, totalMeasures: 0, noteCount: 0 };
  const raw = segmentFrames(frames, { range: opts.range ?? "voice" });
  return liveSummaryFromRaw(raw, frames[frames.length - 1].time, opts);
}

/** 스크린리더용 짧은 요약 */
export function liveAriaSummary(s: LiveSummary): string {
  if (s.noteCount === 0) return "";
  return `${s.totalMeasures}마디까지 ${s.noteCount}개 음이 기록됐어요`;
}
