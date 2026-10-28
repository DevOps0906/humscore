import { describe, expect, it } from "vitest";
import { cutsBetween, planSlices } from "./pdf-slices";

describe("cutsBetween", () => {
  it("시스템 사이 틈의 중간, 잘못된 값 제외", () => {
    const c = cutsBetween(
      [
        { top: 100, bottom: 200 },
        { top: 0, bottom: 80 },
        { top: 220, bottom: 300 },
        { top: Number.NaN, bottom: 5 },
      ],
      400,
    );
    expect(c).toEqual([90, 210]);
  });
});

describe("planSlices", () => {
  it("한 장에 들어가면 1구간", () => {
    expect(planSlices(500, 800, [250])).toEqual([[0, 500]]);
  });
  it("시스템 경계에서 자르고 빈틈없이 이어진다", () => {
    const r = planSlices(1000, 400, [190, 390, 590, 790]);
    expect(r).toEqual([[0, 390], [390, 790], [790, 1000]]);
  });
  it("시스템 하나가 페이지보다 크면 고정 분할", () => {
    expect(planSlices(1000, 400, [900])).toEqual([[0, 400], [400, 800], [800, 1000]]);
  });
  it("컷이 없으면 고정 분할", () => {
    const r = planSlices(900, 400, []);
    expect(r[0]).toEqual([0, 400]);
    expect(r.at(-1)![1]).toBe(900);
  });
});
