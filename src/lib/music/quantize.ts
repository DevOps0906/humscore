import type { NoteEvent, RawNote } from "./types";

export interface QuantizeOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 격자 크기(박). 0.5 = 8분음표, 0.25 = 16분음표 */
  grid: number;
  /** 녹음 시작(0초)이 몇 박째인지. 카운트인 후 바로 녹음하면 0 */
  offsetBeats?: number;
}

/** 박(정수) 경계에서 격자 크기의 이 비율 이내면 박 위로 끌어당김 (박 쪽 편향) */
const ON_BEAT_PULL = 0.4;

/** 격자로 스냅하되, 박 경계 근처면 박에 붙임 */
export function snapBeat(beats: number, grid: number): number {
  const beat = Math.round(beats);
  if (Math.abs(beats - beat) <= grid * ON_BEAT_PULL) return beat;
  return Math.round(beats / grid) * grid;
}

const EPS = 1e-6;

/**
 * 초 단위 음 구간 → 박자 격자에 맞춘 음표·쉼표 목록 (마디 끝까지 쉼표로 채움)
 * - 시작·끝(성대가 떨어진 지점) 모두 격자에 맞추고 길이는 최소 1격자
 * - 앞 음 끝과 다음 음 시작 사이 틈이 격자 반 칸 미만이면 붙임(legato), 1격자 이상이면 쉼표
 */
export function quantizeNotes(raw: RawNote[], opts: QuantizeOptions): NoteEvent[] {
  const spb = 60 / opts.bpm;
  const offset = opts.offsetBeats ?? 0;
  const g = opts.grid;
  const sounded: NoteEvent[] = [];
  /** 최소 길이 보정 전 끝 위치, 원본 끝(박) */
  const meta: { natEnd: number; rawEnd: number }[] = [];

  for (const n of [...raw].sort((a, b) => a.startSec - b.startSec)) {
    if (n.midi === null) continue;
    const rawStart = n.startSec / spb + offset;
    const rawEnd = n.endSec / spb + offset;
    let start = Math.max(0, snapBeat(rawStart, g));
    const natEnd = snapBeat(rawEnd, g);
    let end = natEnd;
    if (end <= start + EPS) end = start + g;
    const pi = sounded.length - 1;
    const prev = sounded[pi];
    if (prev) {
      const prevEnd = prev.startBeat + prev.durationBeats;
      if (start < prevEnd - EPS) {
        if (start >= meta[pi].natEnd - EPS && start > prev.startBeat + EPS) {
          // 앞 음이 최소 길이 보정으로 늘어났을 뿐 -> 앞 음을 줄임
          prev.durationBeats = start - prev.startBeat;
        } else {
          start = prevEnd;
          if (end <= start + EPS) continue;
        }
      } else if (start > prevEnd + EPS && rawStart - meta[pi].rawEnd < g / 2) {
        // 사이가 반 칸 미만으로 붙어 있었음 -> 앞 음을 다음 음 시작까지 연장 (legato)
        prev.durationBeats = start - prev.startBeat;
      }
    }
    sounded.push({ midi: n.midi, startBeat: start, durationBeats: end - start });
    meta.push({ natEnd, rawEnd });
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
