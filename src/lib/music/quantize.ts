import type { NoteEvent, RawNote } from "./types";

export interface QuantizeOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 격자 크기(박). 0.5 = 8분음표, 0.25 = 16분음표 */
  grid: number;
  /** 녹음 시작(0초)이 몇 박째인지. 카운트인 후 바로 녹음하면 0 */
  offsetBeats?: number;
}

const snap = (beats: number, grid: number) => Math.round(beats / grid) * grid;

/** 초 단위 음 구간 → 박자 격자에 맞춘 음표·쉼표 목록 (마디 끝까지 쉼표로 채움) */
export function quantizeNotes(raw: RawNote[], opts: QuantizeOptions): NoteEvent[] {
  const spb = 60 / opts.bpm;
  const offset = opts.offsetBeats ?? 0;
  const sounded: NoteEvent[] = [];

  for (const n of [...raw].sort((a, b) => a.startSec - b.startSec)) {
    if (n.midi === null) continue;
    let start = snap(n.startSec / spb + offset, opts.grid);
    let end = snap(n.endSec / spb + offset, opts.grid);
    if (end <= start) end = start + opts.grid;
    const prev = sounded[sounded.length - 1];
    if (prev && start < prev.startBeat + prev.durationBeats) {
      start = prev.startBeat + prev.durationBeats;
      if (end <= start) continue;
    }
    sounded.push({ midi: n.midi, startBeat: Math.max(0, start), durationBeats: end - Math.max(0, start) });
  }

  return fillRests(sounded, opts.beatsPerMeasure);
}

/** 음표 사이 빈 곳을 쉼표로 채우고 마지막 마디를 완성 */
export function fillRests(notes: NoteEvent[], beatsPerMeasure: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  let cursor = 0;
  for (const n of notes.filter((x) => x.midi !== null).sort((a, b) => a.startBeat - b.startBeat)) {
    if (n.startBeat > cursor + 1e-6) out.push({ midi: null, startBeat: cursor, durationBeats: n.startBeat - cursor });
    out.push({ ...n });
    cursor = n.startBeat + n.durationBeats;
  }
  const total = Math.max(beatsPerMeasure, Math.ceil((cursor - 1e-6) / beatsPerMeasure) * beatsPerMeasure);
  if (total - cursor > 1e-6) out.push({ midi: null, startBeat: cursor, durationBeats: total - cursor });
  return out;
}

export function totalBeats(notes: NoteEvent[]): number {
  return notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
}

export function measureCount(notes: NoteEvent[], beatsPerMeasure: number): number {
  return Math.max(1, Math.ceil((totalBeats(notes) - 1e-6) / beatsPerMeasure));
}
