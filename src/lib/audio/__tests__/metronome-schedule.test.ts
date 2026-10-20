import { describe, expect, it } from "vitest";
import { clicksBefore, dropStaleClicks, patternFor } from "../metronome-schedule";

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

  it("지난 클릭은 건너뛰고 카운트인 시작 직후 클릭은 유지", () => {
    const p = patternFor("4/4", 4);
    const spb = 0.5;
    // 카운트인 시작: t0 가 미래 -> 첫 클릭 유지
    const first = clicksBefore(p, 4, 0, 0.2).clicks;
    expect(dropStaleClicks(first, 1.15, spb, 1.0).map((c) => c.beat)).toEqual([0]);
    // 10초 멈췄다 복귀: 밀린 클릭(beat 0~29, 0~14.5초) 중 now=10 기준 이미 지난 것은 제외
    const backlog = clicksBefore(p, 4, 0, 30).clicks;
    const kept = dropStaleClicks(backlog, 0, spb, 10).map((c) => c.beat);
    expect(kept[0]).toBe(20);
    expect(kept).toHaveLength(10);
    // 50ms 이내 지연은 그대로 재생
    expect(dropStaleClicks([{ beat: 1, level: 1 }], 0, spb, 0.5 + 0.04)).toHaveLength(1);
    expect(dropStaleClicks([{ beat: 1, level: 1 }], 0, spb, 0.5 + 0.06)).toHaveLength(0);
  });
});
