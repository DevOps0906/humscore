import { describe, expect, it } from "vitest";
import { endBeatOnMeasure, hasLyrics, mergeImported } from "./audio-import-logic";
import type { NoteEvent } from "@/lib/music/types";

const n = (startBeat: number, durationBeats: number, lyric?: string): NoteEvent => ({ midi: 60, startBeat, durationBeats, ...(lyric ? { lyric } : {}) });

describe("audio-import-logic", () => {
  const score = { notes: [n(0, 1, "가"), n(1, 2)], chords: [{ startBeat: 0, symbol: "C" }], beatsPerMeasure: 4 };
  const imported = { notes: [n(0, 1), n(1, 1)], chords: [{ startBeat: 0, symbol: "G" }] };

  it("끝 박을 마디 경계로 올린다", () => {
    expect(endBeatOnMeasure(score)).toBe(4);
    expect(endBeatOnMeasure({ ...score, notes: [n(0, 4)] })).toBe(4);
    expect(endBeatOnMeasure({ notes: [], chords: [{ startBeat: 4, symbol: "C" }], beatsPerMeasure: 4 })).toBe(8);
    expect(endBeatOnMeasure({ notes: [], chords: [], beatsPerMeasure: 3 })).toBe(0);
  });

  it("replace 는 음표·코드를 새것으로 바꾼다", () => {
    const r = mergeImported(score, imported, "replace");
    expect(r.notes).toEqual(imported.notes);
    expect(r.chords).toEqual(imported.chords);
    expect(hasLyrics(r)).toBe(false);
  });

  it("append 는 다음 마디부터 이어 붙이고 기존 가사는 유지한다", () => {
    const r = mergeImported(score, imported, "append");
    expect(r.notes.map((x) => x.startBeat)).toEqual([0, 1, 4, 5]);
    expect(r.chords).toEqual([{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }]);
    expect(r.notes[0].lyric).toBe("가");
    expect(imported.notes[0].startBeat).toBe(0); // 원본 불변
  });
});
