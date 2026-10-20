import { describe, expect, it } from "vitest";
import { PROGRESSIONS, buildProgression } from "../progressions";
import { isValidChordSymbol } from "../edit";
import { chordToMidi } from "../theory";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";
import type { KeyInfo } from "../types";

const C: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };
const Am: KeyInfo = { tonic: 9, mode: "minor", fifths: 0 };
const F: KeyInfo = { tonic: 5, mode: "major", fifths: -1 };
const syms = (id: string, key: KeyInfo, n: number) => buildProgression(id, key, n, 4).map((c) => c.symbol);

describe("progressions", () => {
  it("정확히 10개, id 유일, 패턴 길이", () => {
    expect(PROGRESSIONS).toHaveLength(10);
    expect(new Set(PROGRESSIONS.map((p) => p.id)).size).toBe(10);
    for (const p of PROGRESSIONS) expect(buildProgression(p.id, C, p.length, 4)).toHaveLength(p.length);
    expect(PROGRESSIONS.find((p) => p.id === "canon")!.length).toBe(8);
    expect(PROGRESSIONS.find((p) => p.id === "blues12")!.length).toBe(12);
  });
  it("C장조 대표 진행", () => {
    expect(syms("pop4", C, 4)).toEqual(["C", "G", "Am", "F"]);
    expect(syms("jazz251", C, 4)).toEqual(["Dm7", "G7", "Cmaj7", "Am7"]);
    expect(syms("blues12", C, 12)).toEqual(["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"]);
    expect(syms("canon", C, 8)).toEqual(["C", "G", "Am", "Em", "F", "C", "F", "G"]);
  });
  it("단조 매핑, 반복, startBeat", () => {
    expect(syms("pop4", Am, 5)).toEqual(["Am", "F", "C", "G", "Am"]);
    expect(syms("jazz251", Am, 4)).toEqual(["Bdim", "E7", "Am7", "Fmaj7"]);
    expect(buildProgression("pop4", C, 3, 3).map((c) => c.startBeat)).toEqual([0, 3, 6]);
  });
  it("플랫 조는 플랫 표기", () => {
    expect(syms("pop4", F, 4)).toEqual(["F", "C", "Dm", "Bb"]);
    expect(syms("rock", F, 4)).toEqual(["F", "Eb", "Bb", "F"]);
  });
  it("알 수 없는 id 는 빈 배열", () => {
    expect(buildProgression("nope", C, 4, 4)).toEqual([]);
  });
  it("모든 symbol 이 유효하고 구성음·MusicXML 처리 가능 (12조 × 장/단)", () => {
    for (const p of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        for (const mode of ["major", "minor"] as const) {
          const key: KeyInfo = { tonic, mode, fifths: tonic === 5 || tonic === 10 || tonic === 3 ? -2 : 1 };
          const chords = buildProgression(p.id, key, p.length, 4);
          for (const c of chords) {
            expect(isValidChordSymbol(c.symbol), c.symbol).toBe(true);
            expect(chordToMidi(c.symbol).length).toBeGreaterThanOrEqual(3);
          }
          const xml = scoreToMusicXML(makeScore([], { chords, key }), "piano");
          expect((xml.match(/<harmony/g) ?? []).length).toBe(p.length);
        }
      }
    }
  });
});
