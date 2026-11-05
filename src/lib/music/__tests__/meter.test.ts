import { describe, expect, it } from "vitest";
import { METERS, beatsPerMeasureOf, clickPattern, durationLabel, meterOf, timeSignatureOf } from "../meter";

describe("meter", () => {
  it("METERS 6종", () => {
    expect(METERS.map((m) => [m.id, m.beatsPerMeasure, m.beats, m.beatType])).toEqual([
      ["2/4", 2, 2, 4], ["3/4", 3, 3, 4], ["4/4", 4, 4, 4], ["2/2", 4, 2, 2], ["6/8", 3, 6, 8], ["12/8", 6, 12, 8],
    ]);
    expect(METERS.every((m) => m.label === m.id)).toBe(true);
  });
  it("timeSignatureOf / meterOf", () => {
    expect(timeSignatureOf({ beatsPerMeasure: 3, meter: "6/8" })).toEqual({ beats: 6, beatType: 8 });
    expect(timeSignatureOf({ beatsPerMeasure: 3 })).toEqual({ beats: 3, beatType: 4 });
    expect(timeSignatureOf({ beatsPerMeasure: 5 })).toEqual({ beats: 5, beatType: 4 });
    expect(meterOf({ beatsPerMeasure: 3, meter: "6/8" })).toBe("6/8");
    expect(meterOf({ beatsPerMeasure: 3 })).toBe("3/4");
    expect(meterOf({ beatsPerMeasure: 4 })).toBe("4/4");
    expect(meterOf({ beatsPerMeasure: 2 })).toBe("2/4");
    expect(meterOf({ beatsPerMeasure: 4, meter: "2/2" })).toBe("2/2");
    expect(timeSignatureOf({ beatsPerMeasure: 4, meter: "2/2" })).toEqual({ beats: 2, beatType: 2 });
    expect(meterOf({ beatsPerMeasure: 6, meter: "12/8" })).toBe("12/8");
    expect(timeSignatureOf({ beatsPerMeasure: 6, meter: "12/8" })).toEqual({ beats: 12, beatType: 8 });
    expect(beatsPerMeasureOf("12/8")).toBe(6);
    expect(meterOf({ beatsPerMeasure: 5 })).toBeNull();
    expect(beatsPerMeasureOf("6/8")).toBe(3);
    expect(beatsPerMeasureOf("4/4")).toBe(4);
  });
  it("clickPattern", () => {
    expect(clickPattern("3/4").map((c) => c.level)).toEqual([2, 1, 1]);
    expect(clickPattern("4/4").map((c) => c.at)).toEqual([0, 1, 2, 3]);
    expect(clickPattern("6/8")).toEqual([
      { at: 0, level: 2 }, { at: 0.5, level: 0 }, { at: 1, level: 0 },
      { at: 1.5, level: 1 }, { at: 2, level: 0 }, { at: 2.5, level: 0 },
    ]);
  });
  it("새 박자 클릭 패턴은 마디 길이 안에서 강박으로 시작", () => {
    for (const m of METERS) {
      const pattern = clickPattern(m.id);
      expect(pattern[0]).toEqual({ at: 0, level: 2 });
      expect(pattern.every((c) => c.at >= 0 && c.at < m.beatsPerMeasure)).toBe(true);
    }
    expect(clickPattern("12/8").filter((c) => c.level === 1).map((c) => c.at)).toEqual([1.5, 3, 4.5]);
    expect(clickPattern("2/4").map((c) => c.at)).toEqual([0, 1]);
  });
  it("durationLabel", () => {
    expect([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].map(durationLabel)).toEqual(["16분", "8분", "점8분", "4분", "점4분", "2분", "점2분", "온"]);
    expect(durationLabel(5)).toBe("온+4분");
    expect(durationLabel(1.25)).toBe("4분+16분");
    expect(durationLabel(7)).toBe("온+점2분");
  });
});
