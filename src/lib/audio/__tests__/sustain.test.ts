import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isHeldInstrument, isWindOrBrass } from "../instruments";
import {
  DEFAULT_TAP_HOLD, MIN_HOLD, SUSTAIN_DEFAULT, SUSTAIN_MAX, SUSTAIN_MIN, WIND_BRASS_GATE, WIND_BRASS_TAP_HOLD,
  clampSustain, getSustainRatio, heldDuration, loadSustainRatio, setSustainRatio,
} from "../sustain";

describe("지속음 길이", () => {
  it("비율을 0.2~1 범위의 0.05 단위로 맞춘다", () => {
    expect(clampSustain(undefined)).toBe(SUSTAIN_DEFAULT);
    expect(clampSustain(Number.NaN)).toBe(SUSTAIN_DEFAULT);
    expect(clampSustain(0)).toBe(SUSTAIN_MIN);
    expect(clampSustain(5)).toBe(SUSTAIN_MAX);
    expect(clampSustain(0.52)).toBeCloseTo(0.5);
  });

  it("비율 1이면 현악·패드는 악보 길이 그대로, 목관·금관은 숨 자리만큼만 짧다", () => {
    expect(heldDuration(2, 1, false)).toBe(2);
    expect(heldDuration(2, 1, true)).toBeCloseTo(2 * WIND_BRASS_GATE);
  });

  it("슬라이더 비율에 비례해 줄어들지만 최소 길이 아래로는 끊지 않는다", () => {
    expect(heldDuration(2, 0.5, false)).toBeCloseTo(1);
    expect(heldDuration(0.1, 0.2, false)).toBe(MIN_HOLD);
  });

  it("길이가 없는 건반 미리듣기는 목관·금관을 더 짧게 낸다", () => {
    expect(heldDuration(undefined, 1, false)).toBe(DEFAULT_TAP_HOLD);
    expect(heldDuration(undefined, 1, true)).toBe(WIND_BRASS_TAP_HOLD);
    expect(WIND_BRASS_TAP_HOLD).toBeLessThan(DEFAULT_TAP_HOLD);
  });

  it("잘못된 길이는 건반 미리듣기로 취급한다", () => {
    expect(heldDuration(-1, 1, false)).toBe(DEFAULT_TAP_HOLD);
    expect(heldDuration(Number.NaN, 1, false)).toBe(DEFAULT_TAP_HOLD);
  });
});

describe("지속음 악기 분류", () => {
  it("관악·현악·보컬·오르간·패드는 지속음, 피아노·기타·타악기·플럭은 아니다", () => {
    for (const id of ["flute", "oboe", "clarinet", "bassoon", "trumpet", "frenchHorn", "tuba", "violin", "cello", "strings", "choir", "churchOrgan", "warmPad"] as const) expect(isHeldInstrument(id)).toBe(true);
    for (const id of ["piano", "epRhodes", "acousticGuitar", "drumKit", "timpani", "harp", "xylophone", "synthPluck", "synthArp"] as const) expect(isHeldInstrument(id)).toBe(false);
  });

  it("목관·금관만 숨 자리를 둔다", () => {
    for (const id of ["flute", "piccolo", "oboe", "englishHorn", "clarinet", "bassoon", "frenchHorn", "trumpet", "trombone", "bassTrombone", "tuba"] as const) expect(isWindOrBrass(id)).toBe(true);
    for (const id of ["violin", "strings", "choir", "churchOrgan"] as const) expect(isWindOrBrass(id)).toBe(false);
  });
});

describe("저장값", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("설정하면 저장되고 다시 읽으면 복원된다", () => {
    expect(setSustainRatio(0.6)).toBeCloseTo(0.6);
    expect(getSustainRatio()).toBeCloseTo(0.6);
    setSustainRatio(1);
    localStorage.setItem("humscore.sustainRatio", "0.35");
    expect(loadSustainRatio()).toBeCloseTo(0.35);
  });
  it("저장값이 깨져 있으면 기본값을 쓴다", () => {
    localStorage.setItem("humscore.sustainRatio", "abc");
    expect(loadSustainRatio()).toBe(SUSTAIN_DEFAULT);
  });
});
