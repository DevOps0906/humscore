import type { Score, ScorePart } from "./types";
import { instrumentMode, type CreationMode, type InstrumentId } from "./instrument-catalog";

export const MAIN_PART_ID = "main";

export function getScoreParts(score: Score): ScorePart[] {
  return [{ id: MAIN_PART_ID, partName: score.partName, clef: score.clef, notation: score.notation ?? instrumentMode(score.instrument ?? "piano"), instrument: score.instrument ?? (score.notation === "drums" ? "drumKit" : "piano"), notes: score.notes, chords: score.chords, accompaniment: score.accompaniment, dynamics: score.dynamics }, ...(score.parts ?? [])];
}

/** 편집·렌더링용 한 파트 투영. 다른 파트는 포함하지 않는다. */
export function scoreForPart(score: Score, partId: string): Score {
  const part = getScoreParts(score).find((entry) => entry.id === partId) ?? getScoreParts(score)[0];
  return { ...score, ...part, partName: part.partName, clef: part.clef, id: score.id, marks: score.marks, parts: undefined, transpose: part.notation === "drums" ? 0 : score.transpose };
}

export function updateScorePart(score: Score, partId: string, patch: Partial<Score>): Score {
  if (partId === MAIN_PART_ID) return { ...score, ...patch };
  const partKeys = new Set(["partName", "clef", "notes", "chords", "instrument", "notation", "accompaniment", "dynamics"]);
  const partPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => partKeys.has(key)));
  const shared = Object.fromEntries(Object.entries(patch).filter(([key]) => !partKeys.has(key)));
  // 파트 항목은 곡의 첫 파트에 섞지 않는다. undefined도 유지해 항목 삭제를 지원한다.
  return { ...score, ...shared, parts: score.parts?.map((part) => part.id === partId ? { ...part, ...partPatch } : part) };
}

export function addScorePart(score: Score, notation: CreationMode, instrument: InstrumentId): { score: Score; partId: string } {
  const existing = getScoreParts(score).find((part) => part.instrument === instrument && part.notation === notation);
  if (existing) return { score, partId: existing.id };
  const used = new Set(getScoreParts(score).map((part) => part.id));
  let partId = `part-${instrument}`;
  for (let suffix = 2; used.has(partId); suffix++) partId = `part-${instrument}-${suffix}`;
  return { score: { ...score, parts: [...(score.parts ?? []), { id: partId, notation, instrument, notes: [], chords: [] }] }, partId };
}

/** 악기(파트)를 제거한다. 마지막 하나 남은 악기는 제거할 수 없고, 주 파트를 지우면 다음 파트가 주 파트가 된다. */
export function removeScorePart(score: Score, partId: string): { score: Score; activePartId: string } {
  const parts = getScoreParts(score);
  if (parts.length <= 1 || !parts.some((part) => part.id === partId)) return { score, activePartId: partId };
  if (partId !== MAIN_PART_ID) {
    return { score: { ...score, parts: score.parts?.filter((part) => part.id !== partId) }, activePartId: MAIN_PART_ID };
  }
  const [next, ...rest] = score.parts ?? [];
  const { id: _id, ...fields } = next;
  void _id;
  return {
    score: { ...score, ...fields, partName: next.partName, clef: next.clef, accompaniment: next.accompaniment, dynamics: next.dynamics, parts: rest.length ? rest : undefined },
    activePartId: MAIN_PART_ID,
  };
}

/** 한 악기의 음표·코드를 다른 악기에 합치고 원래 악기는 제거한다. 같은 위치·음높이 음표는 한 번만 둔다. */
export function mergeScoreParts(score: Score, fromId: string, intoId: string): { score: Score; activePartId: string } {
  if (fromId === intoId) return { score, activePartId: intoId };
  const parts = getScoreParts(score);
  const from = parts.find((part) => part.id === fromId);
  const into = parts.find((part) => part.id === intoId);
  if (!from || !into) return { score, activePartId: intoId };
  const seen = new Set<string>();
  const notes = [...into.notes, ...from.notes].filter((note) => {
    const key = `${note.startBeat}:${note.midi}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.startBeat - b.startBeat);
  const chordKeys = new Set<string>();
  const chords = [...into.chords, ...from.chords].filter((chord) => {
    const key = `${chord.startBeat}:${chord.symbol}`;
    if (chordKeys.has(key)) return false;
    chordKeys.add(key);
    return true;
  }).sort((a, b) => a.startBeat - b.startBeat);
  const merged = updateScorePart(score, intoId, { notes, chords });
  const removed = removeScorePart(merged, fromId);
  return { score: removed.score, activePartId: getScoreParts(removed.score).some((part) => part.id === intoId) ? intoId : MAIN_PART_ID };
}
