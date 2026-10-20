import { durationLabel } from "../music/meter";
import { MIC_TIMING, quantizeNotes, type QuantizeTiming } from "../music/quantize";
import { segmentFrames, type PitchRange } from "../music/segment";
import type { NoteEvent, PitchFrame, RawNote } from "../music/types";

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

const EMPTY: LiveSummary = { measures: [], active: null, totalMeasures: 0, noteCount: 0 };

/** 마지막 음이 진행 중이면 active 로 분리 (절대 시각 기준) */
function splitActive(raw: RawNote[], nowSec: number, opts: LiveOptions & { activeTolSec?: number }) {
  const spb = 60 / opts.bpm;
  const tol = opts.activeTolSec ?? ACTIVE_TOLERANCE_SEC;
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
  return { active, done };
}

/** 확정 음 → 양자화(꼬리 쉼표 제거). cutBeat 만큼 앞당긴 시간축에서 계산하고 startBeat 는 호출 측이 되돌린다 */
function quantizeDone(done: RawNote[], opts: LiveOptions, cutBeat = 0): NoteEvent[] {
  if (!done.length) return [];
  const timing = opts.timing === undefined ? MIC_TIMING : opts.timing;
  const cutSec = (cutBeat * 60) / opts.bpm;
  const src = cutBeat === 0 ? done : done.map((n) => ({ ...n, startSec: n.startSec - cutSec, endSec: n.endSec - cutSec }));
  let notes = quantizeNotes(src, { bpm: opts.bpm, beatsPerMeasure: opts.beatsPerMeasure, grid: 0.25, timing });
  // 마지막 마디를 채우는 꼬리 쉼표는 아직 연주되지 않은 부분이므로 뺀다
  while (notes.length && notes[notes.length - 1].midi === null) notes = notes.slice(0, -1);
  return notes;
}

function toChips(notes: NoteEvent[], beatsPerMeasure: number, baseIdx: number, beatOffset: number): LiveChip[] {
  return notes.map((n, i) => {
    const startBeat = n.startBeat + beatOffset;
    const measure = Math.floor((startBeat + EPS) / beatsPerMeasure) + 1;
    const name = n.midi === null ? "쉼" : solfegeName(n.midi);
    const duration = durationLabel(n.durationBeats);
    return {
      key: `${baseIdx + i}-${startBeat}-${n.midi}`,
      measure,
      midi: n.midi,
      startBeat,
      durationBeats: n.durationBeats,
      name,
      duration,
      text: `${name} · ${duration}`,
    };
  });
}

function groupChips(chips: LiveChip[]): LiveMeasure[] {
  const groups: LiveMeasure[] = [];
  for (const c of chips) {
    const g = groups[groups.length - 1];
    if (g && g.measure === c.measure) g.chips.push(c);
    else groups.push({ measure: c.measure, chips: [c] });
  }
  return groups;
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
  const maxMeasures = opts.maxMeasures ?? 4;
  const { active, done } = splitActive(raw, nowSec, opts);
  const chips = toChips(quantizeDone(done, opts), opts.beatsPerMeasure, 0, 0);
  const groups = groupChips(chips);
  return {
    measures: groups.slice(-maxMeasures),
    active,
    totalMeasures: groups.length ? groups[groups.length - 1].measure : 0,
    noteCount: chips.filter((c) => c.midi !== null).length,
  };
}

/** 마이크 피치 프레임 → 칩 목록 (최종 악보와 같은 segment/quantize 설정) */
export function liveSummaryFromFrames(frames: PitchFrame[], opts: LiveOptions): LiveSummary {
  if (frames.length === 0) return EMPTY;
  const raw = segmentFrames(frames, { range: opts.range ?? "voice" });
  return liveSummaryFromRaw(raw, frames[frames.length - 1].time, opts);
}

/**
 * 증분 처리 캐시. 앞부분이 확정된(뒤 음과 충분히 떨어진) 음은 칩으로 굳히고,
 * 이후에는 그 뒤 구간의 프레임만 다시 segment/quantize 한다. bpm·박자·음역이 바뀌면 새 캐시를 써야 한다.
 */
export interface LiveFramesCache {
  /** 처리 창이 시작하는 프레임 인덱스 */
  frameIdx: number;
  /** 창 시작 박 (정수). 창 안 양자화는 이만큼 앞당긴 시간축 */
  cutBeat: number;
  /** 확정 음 끝(양자화된 절대 박). 확정 음이 없으면 null */
  prevEndBeat: number | null;
  /** 확정된 칩 개수 (칩 key 의 전역 번호) */
  chipCount: number;
  /** 확정된 쉼표 제외 음표 수 */
  noteCount: number;
  /** 확정 칩 중 마지막 몇 마디만 보관 */
  tail: LiveChip[];
}

export function createLiveFramesCache(): LiveFramesCache {
  return { frameIdx: 0, cutBeat: 0, prevEndBeat: null, chipCount: 0, noteCount: 0, tail: [] };
}

/** 앞 음과 이 시간(초) 이상 떨어진 음 앞에서만 확정 (쉼표로 확실히 끊겨 앞 음에 영향을 주지 않는 간격) */
function commitGapSec(bpm: number): number {
  return Math.max(1.0, 60 / bpm + 0.2);
}

function keepTail(chips: LiveChip[], maxMeasures: number): LiveChip[] {
  let groups = 0;
  let last = -1;
  for (let i = chips.length - 1; i >= 0; i--) {
    if (chips[i].measure !== last) {
      groups++;
      last = chips[i].measure;
      if (groups > maxMeasures) return chips.slice(i + 1);
    }
  }
  return chips;
}

/** 창 안 확정 음 → 절대 박 칩. 창 맨 앞 쉼표는 확정 음 끝부터 시작하도록 맞춤 */
function windowNotes(done: RawNote[], opts: LiveOptions, c: LiveFramesCache): NoteEvent[] {
  const notes = quantizeDone(done, opts, c.cutBeat);
  if (c.prevEndBeat !== null && notes.length && notes[0].midi === null) {
    const shift = c.prevEndBeat - c.cutBeat;
    notes[0] = { ...notes[0], startBeat: notes[0].startBeat + shift, durationBeats: notes[0].durationBeats - shift };
  }
  return notes;
}

/**
 * liveSummaryFromFrames 와 같은 결과를 내되 확정된 앞부분은 다시 계산하지 않는다.
 * 새 캐시를 돌려주며 입력 캐시는 바꾸지 않는다. frames 는 시간순이고 앞쪽이 바뀌지 않는다고 가정(append-only).
 */
export function liveSummaryIncremental(
  frames: PitchFrame[],
  opts: LiveOptions,
  cache: LiveFramesCache,
): { summary: LiveSummary; cache: LiveFramesCache } {
  if (frames.length === 0) return { summary: EMPTY, cache: createLiveFramesCache() };
  const maxMeasures = opts.maxMeasures ?? 4;
  const bpb = opts.beatsPerMeasure;
  const range = opts.range ?? "voice";
  const nowSec = frames[frames.length - 1].time;
  let c = cache.frameIdx < frames.length ? cache : createLiveFramesCache();

  let raw = segmentFrames(frames.slice(c.frameIdx), { range }).filter((n) => n.midi !== null);

  // 뒤 음과 충분히 떨어진 가장 마지막 음까지 확정
  const gap = commitGapSec(opts.bpm);
  let j = -1;
  for (let i = raw.length - 2; i >= 0; i--) {
    if (raw[i + 1].startSec - raw[i].endSec >= gap) {
      j = i;
      break;
    }
  }
  if (j >= 0) {
    const committed = windowNotes(raw.slice(0, j + 1), opts, c);
    const newChips = toChips(committed, bpb, c.chipCount, c.cutBeat);
    const lastEnd = committed.length ? committed[committed.length - 1].startBeat + committed[committed.length - 1].durationBeats + c.cutBeat : c.prevEndBeat;
    const resumeSec = raw[j].endSec + 0.3;
    let fi = c.frameIdx;
    while (fi < frames.length && frames[fi].time < resumeSec) fi++;
    c = {
      frameIdx: fi,
      cutBeat: lastEnd === null ? c.cutBeat : Math.floor(lastEnd + EPS),
      prevEndBeat: lastEnd,
      chipCount: c.chipCount + newChips.length,
      noteCount: c.noteCount + newChips.filter((x) => x.midi !== null).length,
      tail: keepTail([...c.tail, ...newChips], maxMeasures),
    };
    raw = raw.slice(j + 1);
  }

  const { active, done } = splitActive(raw, nowSec, opts);
  const winChips = toChips(windowNotes(done, opts, c), bpb, c.chipCount, c.cutBeat);
  const chips = [...c.tail, ...winChips];
  const groups = groupChips(chips);
  return {
    summary: {
      measures: groups.slice(-maxMeasures),
      active,
      totalMeasures: groups.length ? groups[groups.length - 1].measure : 0,
      noteCount: c.noteCount + winChips.filter((x) => x.midi !== null).length,
    },
    cache: c,
  };
}

/** 스크린리더용 짧은 요약 */
export function liveAriaSummary(s: LiveSummary): string {
  if (s.noteCount === 0) return "";
  return `${s.totalMeasures}마디까지 ${s.noteCount}개 음이 기록됐어요`;
}
