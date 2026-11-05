import { chordToMidi, transposeChordSymbol } from "./theory";
import type { ChordEvent, NoteEvent } from "./types";

export interface AccompanimentSettings {
  mode: "block" | "arpeggio";
  pattern: string;
}

/**
 * 상·하행 분산화음과 알베르티(낮음–높음–중간–높음)는 교육 자료의 원리를 따른다.
 * 나머지는 같은 원리를 옥타브·리듬·방향으로 변형한 앱 자체 템플릿이다.
 * 참고: https://musictheory.pugetsound.edu/mt21c/ArpeggiatedAccompaniments.html
 * https://openbooks.library.baylor.edu/pianobasics/chapter/accompaniment-styles-broken-chord-alberti-bass-and-waltz-bass/
 */
export const ARPEGGIO_PATTERNS = [
  { id: "ascending", label: "상행 8분", description: "낮은 코드음부터 차례로 올라갑니다.", degrees: [0, 1, 2, 3], step: 0.5 },
  { id: "descending", label: "하행 8분", description: "높은 코드음부터 차례로 내려갑니다.", degrees: [3, 2, 1, 0], step: 0.5 },
  { id: "upDown", label: "상행·하행", description: "아래에서 위로 올라간 뒤 내려오는 왕복형입니다.", degrees: [0, 1, 2, 3, 2, 1], step: 0.5 },
  { id: "downUp", label: "하행·상행", description: "위에서 아래로 내려간 뒤 올라오는 왕복형입니다.", degrees: [3, 2, 1, 0, 1, 2], step: 0.5 },
  { id: "alberti", label: "알베르티 베이스", description: "낮음–높음–중간–높음 순서의 전통적인 분산 반주입니다.", degrees: [0, 2, 1, 2], step: 0.5 },
  { id: "reverseAlberti", label: "알베르티 변형", description: "낮음–중간–높음–중간 순서로 부드럽게 반복합니다.", degrees: [0, 1, 2, 1], step: 0.5 },
  { id: "openFifths", label: "넓은 분산화음", description: "낮은음과 옥타브 위 코드음을 넓게 펼칩니다.", degrees: [0, 2, 4, 2], step: 0.5 },
  { id: "octaveWave", label: "옥타브 물결", description: "코드음을 옥타브 위까지 오르내립니다.", degrees: [0, 2, 3, 4, 5, 4, 3, 2], step: 0.5 },
  { id: "waltz", label: "3박 분산형", description: "낮음–중간–높음의 4분음표를 3박 단위로 반복합니다.", degrees: [0, 1, 2], step: 1 },
  { id: "rolling16", label: "흐르는 16분", description: "16분음표로 촘촘하게 오르내리는 반주입니다.", degrees: [0, 1, 2, 3, 4, 3, 2, 1], step: 0.25 },
] as const;

export type ArpeggioPatternId = typeof ARPEGGIO_PATTERNS[number]["id"];
export function isArpeggioPatternId(value: unknown): value is ArpeggioPatternId {
  return typeof value === "string" && ARPEGGIO_PATTERNS.some((entry) => entry.id === value);
}

export interface AccompanimentNote extends NoteEvent { midi: number }

/** 같은 반주 음표를 재생·MIDI·악보가 공유한다. 원본 코드·전조 값은 바꾸지 않는다. */
export function buildAccompanimentNotes(
  chords: readonly ChordEvent[],
  settings: AccompanimentSettings | undefined,
  options: { endBeat: number; beatsPerMeasure: number; transpose?: number; fromBeat?: number },
): AccompanimentNote[] {
  const { endBeat, beatsPerMeasure, transpose = 0, fromBeat = 0 } = options;
  if (!Number.isFinite(endBeat) || endBeat <= 0 || !Number.isFinite(beatsPerMeasure) || beatsPerMeasure <= 0 || !Number.isFinite(fromBeat)) return [];
  const pattern = ARPEGGIO_PATTERNS.find((entry) => entry.id === settings?.pattern) ?? ARPEGGIO_PATTERNS[0];
  const sorted = chords.filter((chord) => Number.isFinite(chord.startBeat)).slice().sort((a, b) => a.startBeat - b.startBeat);
  const output: AccompanimentNote[] = [];
  sorted.forEach((chord, index) => {
    const start = Math.max(0, chord.startBeat);
    const end = Math.min(endBeat, sorted[index + 1]?.startBeat ?? endBeat);
    if (end <= start || end <= fromBeat) return;
    const tones = chordToMidi(transposeChordSymbol(chord.symbol, transpose, false), 3).sort((a, b) => a - b);
    if (!tones.length) return;
    if (settings?.mode !== "arpeggio") {
      const on = Math.max(start, fromBeat);
      for (const midi of tones) output.push({ midi, startBeat: on, durationBeats: end - on });
      return;
    }
    // 코드가 바뀌면 패턴을 다시 시작하고, 탐색 재개 시에는 원래 패턴의 위상을 유지한다.
    const first = Math.max(0, Math.floor((Math.max(fromBeat, start) - start) / pattern.step));
    for (let i = first; start + i * pattern.step < end - 1e-6; i++) {
      const beat = start + i * pattern.step;
      const on = Math.max(beat, fromBeat);
      const finish = Math.min(beat + pattern.step, end);
      if (finish <= on + 1e-6) continue;
      const degree = pattern.degrees[i % pattern.degrees.length];
      const midi = tones[degree % tones.length] + Math.floor(degree / tones.length) * 12;
      if (midi < 0 || midi > 127) continue;
      output.push({ midi, startBeat: on, durationBeats: finish - on });
    }
  });
  return output;
}
