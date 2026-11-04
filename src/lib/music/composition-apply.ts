import { scoreMeasureCount } from "./edit";
import type { ChordEvent, NoteEvent, Score } from "./types";

export type CompositionPlacement = "append" | "replace";

/** 새 후보를 명시적으로 적용한다. 추가는 마지막 마디 뒤부터, 교체는 이전 진행 기호도 정리한다. */
export function applyComposedPhrase(
  score: Score,
  phrase: { notes: NoteEvent[]; chords: ChordEvent[] },
  placement: CompositionPlacement,
): Partial<Score> {
  const offset = placement === "append" && (score.notes.length || score.chords.length)
    ? scoreMeasureCount(score) * score.beatsPerMeasure : 0;
  const notes = [
    ...(placement === "append" ? score.notes : []),
    ...phrase.notes.map((n) => ({ ...n, startBeat: n.startBeat + offset })),
  ];
  const chords = [
    ...(placement === "append" ? score.chords : []),
    ...phrase.chords.map((c) => ({ ...c, startBeat: c.startBeat + offset })),
  ];
  if (notes.length > 6000 || chords.length > 1500) throw new Error("악보의 음표·코드 개수 한도를 넘어요. 마디 수를 줄여 주세요.");
  return placement === "replace" ? { notes, chords, marks: undefined, dynamics: undefined } : { notes, chords };
}
