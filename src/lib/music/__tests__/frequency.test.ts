import { describe, expect, it } from "vitest";
import {
  PIANO_KEYS, centsOff, freqToMidiFloat, freqToNearestMidi, freqToNoteName, midiToFreq, midiToName, octaveOf, pitchClass,
} from "../frequency";

describe("frequency 경계/왕복", () => {
  it("A0, C8 양 끝", () => {
    expect(midiToFreq(21)).toBeCloseTo(27.5, 6);
    expect(midiToFreq(108)).toBeCloseTo(4186.009, 2);
    expect(PIANO_KEYS[0]).toMatchObject({ midi: 21, name: "A0", keyNumber: 1, isBlack: false });
    expect(PIANO_KEYS[87]).toMatchObject({ midi: 108, name: "C8", keyNumber: 88, isBlack: false });
    expect(freqToNoteName(27.5)).toBe("A0");
    expect(freqToNoteName(4186.01)).toBe("C8");
  });
  it("MIDI -> Hz -> MIDI 왕복 (전 건반)", () => {
    for (let m = 21; m <= 108; m++) {
      expect(freqToNearestMidi(midiToFreq(m))).toBe(m);
      expect(freqToMidiFloat(midiToFreq(m))).toBeCloseTo(m, 9);
      expect(Math.abs(centsOff(midiToFreq(m)))).toBeLessThan(1e-6);
    }
  });
  it("센트 왕복", () => {
    for (const c of [30, -30, 49, -49, 0]) {
      const f = midiToFreq(60) * Math.pow(2, c / 1200);
      expect(centsOff(f)).toBeCloseTo(c, 6);
      expect(freqToNearestMidi(f)).toBe(60);
    }
  });
  it("50센트 넘으면 이웃 음", () => {
    expect(freqToNearestMidi(midiToFreq(60) * Math.pow(2, 51 / 1200))).toBe(61);
    expect(freqToNearestMidi(midiToFreq(60) * Math.pow(2, -51 / 1200))).toBe(59);
  });
  it("a4 기준 주파수 변경 (442)", () => {
    expect(midiToFreq(69, 442)).toBe(442);
    expect(freqToNearestMidi(442, 442)).toBe(69);
    expect(centsOff(442, 442)).toBeCloseTo(0, 9);
  });
  it("옥타브는 주파수 2배", () => {
    expect(midiToFreq(81) / midiToFreq(69)).toBeCloseTo(2, 9);
  });
  it("pitchClass / octaveOf: 음수와 경계", () => {
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(-12)).toBe(0);
    expect(octaveOf(12)).toBe(0);
    expect(octaveOf(11)).toBe(-1);
    expect(octaveOf(21)).toBe(0);
    expect(octaveOf(108)).toBe(8);
    expect(midiToName(23)).toBe("B0");
    expect(midiToName(24)).toBe("C1");
  });
  it("PIANO_KEYS: 오름차순, 흑건 위치", () => {
    for (let i = 1; i < 88; i++) expect(PIANO_KEYS[i].freq).toBeGreaterThan(PIANO_KEYS[i - 1].freq);
    expect(PIANO_KEYS.find((k) => k.name === "A#0")?.isBlack).toBe(true);
    expect(PIANO_KEYS.find((k) => k.name === "C4")?.isBlack).toBe(false);
  });
});
