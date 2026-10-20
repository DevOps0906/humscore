import { describe, expect, it } from "vitest";
import { clicksBefore, patternFor } from "../metronome-schedule";

describe("metronome-schedule", () => {
  it("6/8: 한 마디(3박)에 6번, 오름차순, 강-약-약-중-약-약", () => {
    const p = patternFor("6/8", 3);
    const { clicks } = clicksBefore(p, 3, 0, 3);
    expect(clicks.map((c) => c.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(clicks.map((c) => c.level)).toEqual([2, 0, 0, 1, 0, 0]);
  });

  it("여러 마디에 걸쳐 이어 붙고 nextIndex 로 재개", () => {
    const p = patternFor("6/8", 3);
    const a = clicksBefore(p, 3, 0, 3.2);
    expect(a.clicks.at(-1)!.beat).toBe(3);
    const b = clicksBefore(p, 3, a.nextIndex, 6);
    const all = [...a.clicks, ...b.clicks].map((c) => c.beat);
    expect(all.length).toBe(12);
    expect([...all].sort((x, y) => x - y)).toEqual(all);
  });

  it("4/4 와 3/4: 첫 박만 강", () => {
    expect(clicksBefore(patternFor("4/4", 4), 4, 0, 4).clicks.map((c) => c.level)).toEqual([2, 1, 1, 1]);
    expect(clicksBefore(patternFor("3/4", 3), 3, 3, 6).clicks.map((c) => [c.beat, c.level])).toEqual([[3, 2], [4, 1], [5, 1]]);
  });

  it("meter 없으면 정수 박 폴백", () => {
    expect(clicksBefore(patternFor(undefined, 2), 2, 0, 4).clicks.map((c) => [c.beat, c.level])).toEqual([[0, 2], [1, 1], [2, 2], [3, 1]]);
  });
});
