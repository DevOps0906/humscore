import { describe, expect, it } from "vitest";
import { DYNAMIC_VELOCITY, velocityAt } from "../dynamics";
import type { DynamicEvent } from "../types";

describe("velocityAt", () => {
  it("기호 없으면 mf", () => {
    expect(velocityAt(undefined, 3)).toBe(DYNAMIC_VELOCITY.mf);
    expect(velocityAt([], 3)).toBe(DYNAMIC_VELOCITY.mf);
  });
  it("단계 값은 오름차순", () => {
    const v = (["pp", "p", "mp", "mf", "f", "ff"] as const).map((k) => DYNAMIC_VELOCITY[k]);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });
  it("첫 기호 전은 mf, 이후는 다음 기호 전까지 유지", () => {
    const d: DynamicEvent[] = [{ startBeat: 4, kind: "p" }, { startBeat: 12, kind: "ff" }];
    expect(velocityAt(d, 0)).toBe(DYNAMIC_VELOCITY.mf);
    expect(velocityAt(d, 4)).toBe(DYNAMIC_VELOCITY.p);
    expect(velocityAt(d, 11.9)).toBe(DYNAMIC_VELOCITY.p);
    expect(velocityAt(d, 12)).toBe(DYNAMIC_VELOCITY.ff);
  });
  it("입력이 정렬돼 있지 않아도 동작", () => {
    expect(velocityAt([{ startBeat: 8, kind: "f" }, { startBeat: 0, kind: "p" }], 4)).toBe(DYNAMIC_VELOCITY.p);
  });
  it("cresc: 다음 단계 기호로 선형 보간 후 유지", () => {
    const d: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "cresc", durationBeats: 4 }, { startBeat: 8, kind: "ff" }];
    expect(velocityAt(d, 4)).toBeCloseTo(DYNAMIC_VELOCITY.p);
    expect(velocityAt(d, 6)).toBeCloseTo((DYNAMIC_VELOCITY.p + DYNAMIC_VELOCITY.ff) / 2);
    expect(velocityAt(d, 8)).toBeCloseTo(DYNAMIC_VELOCITY.ff);
  });
  it("dim: 목표 기호가 없으면 한 단계 아래로", () => {
    const d: DynamicEvent[] = [{ startBeat: 0, kind: "f" }, { startBeat: 0, kind: "f" }, { startBeat: 2, kind: "dim", durationBeats: 2 }];
    expect(velocityAt(d, 4)).toBeCloseTo(DYNAMIC_VELOCITY.mf);
    expect(velocityAt(d, 3)).toBeCloseTo((DYNAMIC_VELOCITY.f + DYNAMIC_VELOCITY.mf) / 2);
    expect(velocityAt(d, 100)).toBeCloseTo(DYNAMIC_VELOCITY.mf);
  });
  it("cresc 목표 없고 ff 면 그대로 ff", () => {
    const d: DynamicEvent[] = [{ startBeat: 0, kind: "ff" }, { startBeat: 2, kind: "cresc", durationBeats: 2 }];
    expect(velocityAt(d, 3)).toBeCloseTo(DYNAMIC_VELOCITY.ff);
  });
});
