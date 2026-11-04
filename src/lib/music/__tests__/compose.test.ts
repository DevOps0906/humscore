import { describe, expect, it } from "vitest";
import { composeMelody, reharmonize, type MelodyStyle } from "../compose";
import { isValidChordSymbol } from "../edit";
import { chordToMidi } from "../theory";
import { makeScore } from "./helpers";

const options = { measures: 8, progressionId: "pop4", style: "balanced" as const, seed: 42 };
const pc = (midi: number) => ((midi % 12) + 12) % 12;

describe("코드 진행을 바탕으로 새 멜로디 작곡", () => {
  it("2-5-1 진행으로 8마디를 완성하고 강박은 해당 코드의 구성음으로 만든다", () => {
    const result = composeMelody(makeScore([]), { ...options, progressionId: "two-five-one" });
    expect(result.chords.map((chord) => chord.symbol)).toEqual(["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"]);
    expect(result.notes.at(-1)!.startBeat + result.notes.at(-1)!.durationBeats).toBe(32);
    for (const note of result.notes.filter((n) => n.startBeat % 4 === 0)) {
      const chord = result.chords.find((c) => c.startBeat === note.startBeat)!;
      expect(chordToMidi(chord.symbol).map(pc)).toContain(pc(note.midi!));
    }
  });
  it.each<MelodyStyle>(["balanced", "lyrical", "rhythmic"])("%s는 선택한 마디만 빈틈없이 채우고 강박에 코드 음을 둔다", (style) => {
    const original = makeScore([{ midi: 58, startBeat: 0, durationBeats: 1, lyric: "기" }]);
    const before = structuredClone(original);
    const result = composeMelody(original, { ...options, style });
    let end = 0;
    for (const note of result.notes) {
      expect(note.startBeat).toBeCloseTo(end);
      expect(note.midi).toBeGreaterThanOrEqual(60);
      expect(note.midi).toBeLessThanOrEqual(84);
      expect(note.durationBeats).toBeGreaterThan(0);
      end += note.durationBeats;
      if (Math.abs(note.startBeat % 2) < 1e-6) {
        const chord = result.chords.filter((c) => c.startBeat <= note.startBeat).at(-1)!;
        expect(chordToMidi(chord.symbol).map(pc)).toContain(pc(note.midi!));
      }
    }
    expect(end).toBe(32);
    expect(result.chords).toHaveLength(8);
    expect(original).toEqual(before);
  });

  it.each(["3/4", "6/8"] as const)("%s 박자를 정확히 채우고 자연단조를 지원한다", (meter) => {
    const result = composeMelody(makeScore([], { meter, beatsPerMeasure: 3, key: { tonic: 9, mode: "minor", fifths: 0 } }), { ...options, measures: 5 });
    expect(result.notes.at(-1)!.startBeat + result.notes.at(-1)!.durationBeats).toBe(15);
    expect(result.chords[0].symbol).toBe("Am");
    for (const note of result.notes.filter((n) => n.startBeat % 3 === 0 || meter === "6/8" && n.startBeat % 3 === 1.5)) {
      const chord = result.chords.filter((c) => c.startBeat <= note.startBeat).at(-1)!;
      expect(chordToMidi(chord.symbol).map(pc)).toContain(pc(note.midi!));
    }
  });

  it("같은 seed는 같은 결과이고 다른 변주 번호와 스타일은 다른 리듬·음정을 만든다", () => {
    const score = makeScore([]);
    const first = composeMelody(score, options);
    expect(composeMelody(score, options)).toEqual(first);
    expect(composeMelody(score, { ...options, seed: 123 })).not.toEqual(first);
    expect(composeMelody(score, { ...options, style: "rhythmic" }).notes.map((n) => n.durationBeats)).not.toEqual(first.notes.map((n) => n.durationBeats));
  });

  it("현재 코드 진행은 마디 중간 변화까지 반복하고 첫 코드 이전 구간도 채운다", () => {
    const result = composeMelody(makeScore([], { chords: [{ startBeat: 1, symbol: "C" }, { startBeat: 2, symbol: "F#" }] }), { ...options, measures: 3, useExistingChords: true });
    expect(result.chords).toEqual([
      { startBeat: 0, symbol: "C" }, { startBeat: 1, symbol: "C" }, { startBeat: 2, symbol: "F#" },
      { startBeat: 4, symbol: "C" }, { startBeat: 5, symbol: "C" }, { startBeat: 6, symbol: "F#" },
      { startBeat: 8, symbol: "C" }, { startBeat: 9, symbol: "C" }, { startBeat: 10, symbol: "F#" },
    ]);
    for (const beat of [2, 6, 10]) {
      const note = result.notes.find((n) => n.startBeat === beat)!;
      expect(note).toBeDefined();
      expect(chordToMidi("F#").map(pc)).toContain(pc(note.midi!));
    }
    expect(result.notes.at(-1)!.midi).toBeTypeOf("number");
  });

  it("현재 진행은 마지막 코드가 유지되는 원곡 전체 길이를 보존한 뒤 반복한다", () => {
    const score = makeScore([{ midi: 67, startBeat: 0, durationBeats: 32 }], {
      chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }],
    });
    const current = composeMelody(score, { ...options, useExistingChords: true });
    expect(current.chords).toEqual([{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }]);
    for (const note of current.notes.filter((n) => n.startBeat >= 4 && n.startBeat % 2 === 0)) {
      expect(chordToMidi("G").map(pc)).toContain(pc(note.midi!));
    }
    const extended = composeMelody(score, { ...options, measures: 12, useExistingChords: true });
    expect(extended.chords).toEqual([
      { startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" },
      { startBeat: 32, symbol: "C" }, { startBeat: 36, symbol: "G" },
    ]);
    expect(extended.notes.at(-1)!.startBeat + extended.notes.at(-1)!.durationBeats).toBe(48);
  });

  it.each([0, 1.5, 33, Number.NaN, Number.POSITIVE_INFINITY])("잘못된 마디 수 %s를 거부한다", (measures) => {
    expect(() => composeMelody(makeScore([]), { ...options, measures })).toThrow();
  });

  it("존재하지 않는 진행·빈 현재 코드·잘못된 코드·변주 값을 거부한다", () => {
    expect(() => composeMelody(makeScore([]), { ...options, progressionId: "unknown" })).toThrow();
    expect(() => composeMelody(makeScore([]), { ...options, useExistingChords: true })).toThrow();
    expect(() => composeMelody(makeScore([], { chords: [{ startBeat: 0, symbol: "bad" }] }), { ...options, useExistingChords: true })).toThrow();
    expect(() => composeMelody(makeScore([]), { ...options, seed: Number.NaN })).toThrow();
  });
});

describe("멜로디를 유지하는 리하모니제이션", () => {
  const score = makeScore([
    { midi: 60, startBeat: 0, durationBeats: 4, lyric: "빛", lyrics: { "2": "별" } },
    { midi: 62, startBeat: 4, durationBeats: 4 },
    { midi: 64, startBeat: 8, durationBeats: 4 },
    { midi: 60, startBeat: 12, durationBeats: 4 },
  ], { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }, { startBeat: 8, symbol: "C" }, { startBeat: 12, symbol: "C" }] });

  it.each(["gentle", "jazz", "color"] as const)("%s 코드 후보는 유효하며 멜로디·가사를 변경하지 않는다", (style) => {
    const before = structuredClone(score);
    const result = reharmonize(score, style);
    expect(result).toHaveLength(4);
    result.forEach((chord, i) => {
      expect(chord.startBeat).toBe(i * 4);
      expect(isValidChordSymbol(chord.symbol)).toBe(true);
      expect(chordToMidi(chord.symbol).map(pc)).toContain(pc(score.notes[i].midi!));
    });
    expect(score).toEqual(before);
  });

  it("장르별 후보가 다르고 반복 실행해도 안정적이다", () => {
    const gentle = reharmonize(score, "gentle");
    const jazz = reharmonize(score, "jazz");
    const color = reharmonize(score, "color");
    expect(gentle).not.toEqual(jazz);
    expect(color).not.toEqual(jazz);
    expect(reharmonize(score, "jazz")).toEqual(jazz);
    expect(jazz.some((c) => c.symbol.includes("7"))).toBe(true);
  });

  it("마디 끝에 걸친 멜로디를 유지하고 오래된 뒤쪽 코드로 빈 마디를 만들지 않는다", () => {
    const result = reharmonize(makeScore([{ midi: 64, startBeat: 0, durationBeats: 5 }], { chords: [{ startBeat: 40, symbol: "G" }] }), "gentle");
    expect(result).toHaveLength(2);
  });

  it("빈 멜로디와 유효하지 않은 박 위치를 거부한다", () => {
    expect(() => reharmonize(makeScore([]), "jazz")).toThrow();
    expect(() => reharmonize(makeScore([{ midi: 60, startBeat: Number.NaN, durationBeats: 1 }]), "jazz")).toThrow();
  });
});
