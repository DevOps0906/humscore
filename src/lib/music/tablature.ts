import type { Score } from "./types";

export type GuitarInstrumentId = "classicalGuitar" | "acousticGuitar" | "electricGuitar" | "bassGuitar" | "bassGuitar5";

/** 1번 줄(가장 높은 줄)부터의 표준 조율. 값은 실제 울리는 MIDI 음높이다. */
export const GUITAR_TUNINGS: Record<GuitarInstrumentId, readonly number[]> = {
  classicalGuitar: [64, 59, 55, 50, 45, 40],
  acousticGuitar: [64, 59, 55, 50, 45, 40],
  electricGuitar: [64, 59, 55, 50, 45, 40],
  bassGuitar: [43, 38, 33, 28],
  bassGuitar5: [43, 38, 33, 28, 23],
};

export function isGuitarInstrument(value: unknown): value is GuitarInstrumentId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GUITAR_TUNINGS, value);
}

export interface GuitarPosition {
  /** 가장 높은 줄이 1번이다. */
  string: number;
  /** 0은 개방현이다. */
  fret: number;
}

export interface TabNote {
  noteIndex: number;
  startBeat: number;
  durationBeats: number;
  /** 전조를 적용한 실제 음높이. 쉼표는 null이다. */
  midi: number | null;
  string: number | null;
  fret: number | null;
  /** 소리가 있는 음이 조율·프렛 범위를 벗어났을 때만 true다. */
  unplayable: boolean;
}

/** 같은 음높이를 낼 수 있는 모든 줄·프렛. 옥타브를 바꾸어 맞추지 않는다. */
export function guitarPositions(midi: number, instrument: GuitarInstrumentId, maxFret = 24): GuitarPosition[] {
  if (!Number.isInteger(midi) || !Number.isInteger(maxFret) || maxFret < 0 || !isGuitarInstrument(instrument)) return [];
  return GUITAR_TUNINGS[instrument].flatMap((openMidi, index) => {
    const fret = midi - openMidi;
    return fret >= 0 && fret <= maxFret ? [{ string: index + 1, fret }] : [];
  });
}

const positionCost = (position: GuitarPosition) => position.fret * 0.08;
const movementCost = (from: GuitarPosition, to: GuitarPosition) => Math.abs(to.fret - from.fret) * 2 + Math.abs(to.string - from.string) * 0.5;

/**
 * 선율을 TAB 위치로 변환한다. 전조는 출력에만 적용하고 원본 Score는 보존한다.
 * 시간순 인접 음의 프렛·줄 이동 합을 동적 계획법으로 줄여 운지를 고른다.
 * 쉼표·범위 밖 음은 별도로 남기고, 반환 순서는 원본 notes와 같다.
 */
export function scoreToTab(score: Score, instrument: GuitarInstrumentId): TabNote[] {
  const result: TabNote[] = score.notes.map((note, noteIndex) => ({
    noteIndex,
    startBeat: note.startBeat,
    durationBeats: note.durationBeats,
    midi: note.midi === null ? null : note.midi + score.transpose,
    string: null,
    fret: null,
    unplayable: note.midi !== null,
  }));
  const playable = result
    .map((note) => ({ note, positions: note.midi === null ? [] : guitarPositions(note.midi, instrument) }))
    .filter((entry) => entry.positions.length > 0)
    .sort((left, right) => left.note.startBeat - right.note.startBeat || left.note.noteIndex - right.note.noteIndex);
  if (!playable.length) return result;

  const costs: number[][] = [];
  const previous: number[][] = [];
  playable.forEach((entry, index) => {
    costs[index] = [];
    previous[index] = [];
    entry.positions.forEach((position, choice) => {
      let bestCost = Infinity;
      let bestPrevious = 0;
      if (index === 0) bestCost = 0;
      else playable[index - 1].positions.forEach((from, previousChoice) => {
        const cost = costs[index - 1][previousChoice] + movementCost(from, position);
        if (cost < bestCost) { bestCost = cost; bestPrevious = previousChoice; }
      });
      costs[index][choice] = bestCost + positionCost(position);
      previous[index][choice] = bestPrevious;
    });
  });

  const lastCosts = costs[costs.length - 1];
  let choice = lastCosts.indexOf(Math.min(...lastCosts));
  for (let index = playable.length - 1; index >= 0; index--) {
    const { note, positions } = playable[index];
    Object.assign(result[note.noteIndex], positions[choice], { unplayable: false });
    choice = previous[index][choice];
  }
  return result;
}
