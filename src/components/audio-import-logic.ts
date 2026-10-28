import type { Score } from "@/lib/music/types";

export type ImportMode = "replace" | "append";

/** 기존 음표 중 가사가 달린 것이 있는지 (교체 시 경고용) */
export const hasLyrics = (score: Pick<Score, "notes">) => score.notes.some((n) => !!n.lyric);

/** 음표 끝(코드는 그 마디 끝까지)을 마디 경계로 올린 박 */
export function endBeatOnMeasure(score: Pick<Score, "notes" | "chords" | "beatsPerMeasure">): number {
  const bpm = score.beatsPerMeasure;
  const end = Math.max(
    0,
    ...score.notes.map((n) => n.startBeat + n.durationBeats),
    ...score.chords.map((c) => (Math.floor(c.startBeat / bpm + 1e-9) + 1) * bpm),
  );
  return end > 0 ? Math.ceil(end / bpm - 1e-9) * bpm : 0;
}

/**
 * 음원에서 만든 음표·코드를 현재 악보에 반영할 patch.
 * replace: 음표·코드를 새것으로(기존 가사는 사라짐) / append: 현재 끝 다음 마디부터 이어 붙임.
 * 조·박자·셈여림·마디 기호 등 나머지는 그대로 둔다.
 */
export function mergeImported(
  score: Pick<Score, "notes" | "chords" | "beatsPerMeasure">,
  imported: Pick<Score, "notes" | "chords">,
  mode: ImportMode,
): Pick<Score, "notes" | "chords"> {
  if (mode === "replace") return { notes: imported.notes, chords: imported.chords };
  const offset = endBeatOnMeasure(score);
  return {
    notes: [...score.notes, ...imported.notes.map((n) => ({ ...n, startBeat: n.startBeat + offset }))],
    chords: [...score.chords, ...imported.chords.map((c) => ({ ...c, startBeat: c.startBeat + offset }))],
  };
}
