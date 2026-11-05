import type { NoteEvent } from "./types";

export function canTie(notes: readonly NoteEvent[], index: number): boolean {
  const a = notes[index], b = notes[index + 1];
  return !!a && !!b && a.midi !== null && a.midi === b.midi && Math.abs(a.startBeat + a.durationBeats - b.startBeat) < 1e-6;
}

/** 붙임줄은 음높이를 바꾸지 않고 연속한 같은 음을 한 번만 발음한다. */
export function mergeTiedNotes<T extends NoteEvent>(notes: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < notes.length; i++) {
    const note = { ...notes[i] };
    while (notes[i].tieToNext && canTie(notes, i)) {
      note.durationBeats += notes[++i].durationBeats;
    }
    out.push(note);
  }
  return out;
}
