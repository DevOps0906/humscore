import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFERENCES_KEY, clampDefaultBpm, loadScoreDefaults, saveScoreDefaults } from "./preferences";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("preferences", () => {
  it("저장값이 없으면 90 BPM · 4/4", () => {
    expect(loadScoreDefaults()).toEqual({ bpm: 90, meter: "4/4" });
  });
  it("저장 후 다시 읽으면 같은 값", () => {
    saveScoreDefaults({ bpm: 120 });
    saveScoreDefaults({ meter: "6/8" });
    expect(loadScoreDefaults()).toEqual({ bpm: 120, meter: "6/8" });
  });
  it("템포는 40~200 정수로 제한, 잘못된 값은 기본값", () => {
    expect(clampDefaultBpm(10)).toBe(40);
    expect(clampDefaultBpm(999)).toBe(200);
    expect(clampDefaultBpm(99.6)).toBe(100);
    expect(clampDefaultBpm("abc")).toBe(90);
  });
  it("깨진 JSON·잘못된 박자는 기본값", () => {
    store.set(PREFERENCES_KEY, "{oops");
    expect(loadScoreDefaults()).toEqual({ bpm: 90, meter: "4/4" });
    store.set(PREFERENCES_KEY, JSON.stringify({ bpm: 300, meter: "5/4" }));
    expect(loadScoreDefaults()).toEqual({ bpm: 200, meter: "4/4" });
  });
  it("저장소 접근이 막혀도 예외 없이 기본값", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadScoreDefaults()).toEqual({ bpm: 90, meter: "4/4" });
    expect(saveScoreDefaults({ bpm: 100 })).toEqual({ bpm: 100, meter: "4/4" });
  });
});
