import { describe, expect, it } from "vitest";
import { heldMsToBeats, quantizeHeldDuration } from "../key-duration";

describe("heldMsToBeats", () => {
  it("bpm 120 에서 500ms = 1박", () => {
    expect(heldMsToBeats(500, 120)).toBeCloseTo(1);
  });
  it("잘못된 입력은 0", () => {
    expect(heldMsToBeats(-5, 120)).toBe(0);
    expect(heldMsToBeats(500, 0)).toBe(0);
    expect(heldMsToBeats(Number.NaN, 120)).toBe(0);
  });
});

describe("quantizeHeldDuration (bpm 60 → 1초 = 1박)", () => {
  const q = (ms: number, meter: "4/4" | "3/4" | "6/8" = "4/4") => quantizeHeldDuration(ms, 60, meter);
  it("정확한 음가", () => {
    expect(q(250)).toBe(0.25);
    expect(q(500)).toBe(0.5);
    expect(q(750)).toBe(0.75);
    expect(q(1000)).toBe(1);
    expect(q(1500)).toBe(1.5);
    expect(q(2000)).toBe(2);
    expect(q(3000)).toBe(3);
    expect(q(4000)).toBe(4);
  });
  it("가장 가까운 음가로 반올림", () => {
    expect(q(300)).toBe(0.25);
    expect(q(430)).toBe(0.5);
    expect(q(900)).toBe(1);
    expect(q(1300)).toBe(1.5);
    expect(q(1800)).toBe(2);
    expect(q(2600)).toBe(3);
    expect(q(3600)).toBe(4);
  });
  it("아주 짧으면 16분, 아주 길면 온음표", () => {
    expect(q(0)).toBe(0.25);
    expect(q(10)).toBe(0.25);
    expect(q(60000)).toBe(4);
  });
  it("정확히 중간이면 짧은 쪽", () => {
    expect(q(375)).toBe(0.25);
    expect(q(2500)).toBe(2);
  });
  it("3/4·6/8 은 마디(3박)를 넘지 않음", () => {
    expect(q(4000, "3/4")).toBe(3);
    expect(q(4000, "6/8")).toBe(3);
    expect(q(2000, "3/4")).toBe(2);
  });
  it("bpm 에 따라 달라짐", () => {
    expect(quantizeHeldDuration(500, 120, "4/4")).toBe(1);
    expect(quantizeHeldDuration(500, 60, "4/4")).toBe(0.5);
    expect(quantizeHeldDuration(500, 240, "4/4")).toBe(2);
  });
  it("잘못된 입력은 16분", () => {
    expect(quantizeHeldDuration(Number.NaN, 90, "4/4")).toBe(0.25);
    expect(quantizeHeldDuration(1000, -1, "4/4")).toBe(0.25);
  });
});
