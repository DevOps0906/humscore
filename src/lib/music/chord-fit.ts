import { midiToName } from "./frequency";
import { chordToMidi } from "./theory";
import type { ChordEvent, NoteEvent, Score } from "./types";

/**
 * 멜로디 음이 코드와 어울리는지 판정한다(브라우저 의존 없음).
 * 코드 구성음에 더해, 널리 쓰는 대리코드의 구성음과 음악적으로 안전한 색깔 음(9도·6도)도 어울린다고 본다.
 * 대리코드: 장조 코드 → relative minor(vi)·iii, 단조 코드 → relative major(III)·VI,
 *          도미넌트 7 → 트라이톤 대리(♭II7)·ii m7.
 */

const EPS = 1e-6;
const pc = (n: number) => ((n % 12) + 12) % 12;

function parts(symbol: string): { root: number; quality: string } | null {
  const m = /^([A-G])([#b]?)(maj7|m7|m|dim|7|sus4)?(?:\/[A-G][#b]?)?$/.exec(symbol);
  if (!m) return null;
  const letter: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return { root: pc(letter[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0)), quality: m[3] ?? "" };
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const symbolOf = (root: number, quality: string) => NAMES[pc(root)] + quality;

/** 코드 자체의 구성음(피치클래스) */
export function chordTones(symbol: string): number[] {
  return [...new Set(chordToMidi(symbol).map(pc))];
}

/** 대리코드 기호 목록(원 코드는 제외) */
export function substituteChords(symbol: string): string[] {
  const p = parts(symbol);
  if (!p) return [];
  const { root, quality } = p;
  if (quality === "m" || quality === "m7") return [symbolOf(root + 3, "maj7"), symbolOf(root + 8, "maj7")];
  if (quality === "7") return [symbolOf(root + 6, "7"), symbolOf(root + 7, "m7")];
  if (quality === "dim") return [symbolOf(root + 3, "dim"), symbolOf(root + 1, "7")];
  if (quality === "sus4") return [symbolOf(root, ""), symbolOf(root, "7")];
  // 메이저·maj7
  return [symbolOf(root + 9, "m7"), symbolOf(root + 4, "m7")];
}

/** 어울리는 음 전체: 구성음 + 대리코드 구성음 + 색깔 음(9도, 장3화음의 6도, 마이너의 11도) */
export function fittingPitchClasses(symbol: string): Set<number> {
  const set = new Set<number>(chordTones(symbol));
  for (const substitute of substituteChords(symbol)) for (const tone of chordTones(substitute)) set.add(tone);
  const p = parts(symbol);
  if (p) {
    set.add(pc(p.root + 2)); // 9도
    if (p.quality === "" || p.quality === "maj7") set.add(pc(p.root + 9)); // 6도
    if (p.quality === "m" || p.quality === "m7") set.add(pc(p.root + 5)); // 11도(마이너 코드 위의 4도음)
  }
  return set;
}

export function noteFitsChord(midi: number, symbol: string): boolean {
  return fittingPitchClasses(symbol).has(pc(midi));
}

export interface ChordMisfit {
  chord: ChordEvent;
  noteIndex: number;
  note: NoteEvent;
}

/** 코드 구간 [start, end) 안에서 코드와 어울리지 않는 '중요한' 음. 구간 첫 음·강박·1박 이상 머무는 음만 본다. */
export function misfitsInRange(notes: readonly NoteEvent[], symbol: string, start: number, end: number, strongEvery = 2): { noteIndex: number; note: NoteEvent }[] {
  const out: { noteIndex: number; note: NoteEvent }[] = [];
  notes.forEach((note, noteIndex) => {
    if (note.midi === null) return;
    if (note.startBeat < start - EPS || note.startBeat >= end - EPS) return;
    const local = note.startBeat - start;
    const important = local < EPS || note.durationBeats >= 1 - EPS || Math.abs(note.startBeat % strongEvery) < EPS;
    if (important && !noteFitsChord(note.midi, symbol)) out.push({ noteIndex, note });
  });
  return out;
}

/**
 * 코드를 nextChords 로 바꿀 때 새로 생기는 부조화. 바뀌지 않은 코드(같은 위치·같은 기호)는 건너뛴다.
 * 점수의 음표와 코드는 원키 기준이므로 전조와 무관하게 비교한다.
 */
export function chordChangeMisfits(score: Pick<Score, "notes" | "chords" | "beatsPerMeasure">, nextChords: readonly ChordEvent[]): ChordMisfit[] {
  const sorted = [...nextChords].sort((a, b) => a.startBeat - b.startBeat);
  const lastBeat = score.notes.reduce((end, note) => Math.max(end, note.startBeat + note.durationBeats), 0);
  const out: ChordMisfit[] = [];
  sorted.forEach((chord, index) => {
    const unchanged = score.chords.some((old) => Math.abs(old.startBeat - chord.startBeat) < EPS && old.symbol === chord.symbol);
    const next = sorted[index + 1]?.startBeat ?? Math.max(lastBeat, chord.startBeat + score.beatsPerMeasure);
    // 앞 코드가 바뀌어 이 코드의 구간이 달라지는 경우도 다시 본다.
    const previousChanged = index > 0 && !score.chords.some((old) => Math.abs(old.startBeat - sorted[index - 1].startBeat) < EPS && old.symbol === sorted[index - 1].symbol);
    if (unchanged && !previousChanged && score.chords.some((old) => Math.abs(old.startBeat - next) < EPS || next >= lastBeat)) {
      // 구간 끝이 그대로면 판정이 달라지지 않는다.
      const oldNext = [...score.chords].sort((a, b) => a.startBeat - b.startBeat).find((old) => old.startBeat > chord.startBeat + EPS)?.startBeat;
      if (oldNext === undefined ? sorted[index + 1] === undefined : Math.abs(oldNext - next) < EPS) return;
    }
    for (const hit of misfitsInRange(score.notes, chord.symbol, chord.startBeat, next, score.beatsPerMeasure >= 4 ? 2 : score.beatsPerMeasure)) out.push({ chord, ...hit });
  });
  return out;
}

/** 모달에 보여 줄 한 줄 설명. 예) "2마디 1박 E(미)음 · G 코드" */
export function describeMisfit(misfit: ChordMisfit, beatsPerMeasure: number, preferFlats = false): string {
  const measure = Math.floor(misfit.note.startBeat / beatsPerMeasure) + 1;
  const beat = Number((misfit.note.startBeat % beatsPerMeasure + 1).toFixed(2));
  return `${measure}마디 ${beat}박 ${midiToName(misfit.note.midi!, preferFlats).replace(/\d+$/, "")}음 · ${misfit.chord.symbol} 코드`;
}
