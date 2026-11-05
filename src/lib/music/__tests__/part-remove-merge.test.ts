import { describe, expect, it } from "vitest";
import { addScorePart, getScoreParts, MAIN_PART_ID, mergeScoreParts, removeScorePart, updateScorePart } from "../parts";
import type { Score } from "../types";

const base = (): Score => ({
  id: "s", title: "t", bpm: 100, beatsPerMeasure: 4, beatUnit: 4, key: { tonic: 0, mode: "major", fifths: 0 },
  notes: [{ midi: 60, startBeat: 0, durationBeats: 1 }], chords: [], transpose: 0, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
} as Score);

describe("악기 제거·합치기", () => {
  it("하나뿐인 악기는 제거되지 않는다", () => {
    const score = base();
    expect(removeScorePart(score, MAIN_PART_ID).score).toBe(score);
  });
  it("추가한 악기를 제거하면 나머지는 그대로다", () => {
    const added = addScorePart(base(), "orchestra", "flute");
    const removed = removeScorePart(added.score, added.partId);
    expect(getScoreParts(removed.score).map((p) => p.id)).toEqual([MAIN_PART_ID]);
    expect(removed.activePartId).toBe(MAIN_PART_ID);
    expect(removed.score.notes).toHaveLength(1);
  });
  it("주 악기를 제거하면 다음 악기가 주 악기가 된다", () => {
    const added = addScorePart(base(), "orchestra", "flute");
    const withNotes = updateScorePart(added.score, added.partId, { notes: [{ midi: 72, startBeat: 0, durationBeats: 2 }] });
    const removed = removeScorePart(withNotes, MAIN_PART_ID);
    const parts = getScoreParts(removed.score);
    expect(parts).toHaveLength(1);
    expect(parts[0].instrument).toBe("flute");
    expect(removed.score.notes[0].midi).toBe(72);
    expect(removed.score.parts).toBeUndefined();
  });
  it("합치면 음표가 정렬·중복 제거되고 원래 악기는 사라진다", () => {
    const added = addScorePart(base(), "orchestra", "flute");
    const withNotes = updateScorePart(added.score, added.partId, { notes: [{ midi: 60, startBeat: 0, durationBeats: 1 }, { midi: 64, startBeat: 2, durationBeats: 1 }] });
    const merged = mergeScoreParts(withNotes, added.partId, MAIN_PART_ID);
    expect(merged.score.notes.map((n) => [n.midi, n.startBeat])).toEqual([[60, 0], [64, 2]]);
    expect(getScoreParts(merged.score)).toHaveLength(1);
    expect(merged.activePartId).toBe(MAIN_PART_ID);
  });
  it("자기 자신과는 합치지 않는다", () => {
    const score = base();
    expect(mergeScoreParts(score, MAIN_PART_ID, MAIN_PART_ID).score).toBe(score);
  });
});
