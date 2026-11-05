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
