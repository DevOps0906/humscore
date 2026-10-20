import { describe, expect, it } from "vitest";
import { liveSummaryFromFrames, liveSummaryFromRaw, solfegeName } from "../live-notes";
import type { PitchFrame, RawNote } from "../../music/types";

const base = { bpm: 60, beatsPerMeasure: 4, timing: null } as const;
const n = (midi: number, a: number, b: number): RawNote => ({ midi, startSec: a, endSec: b, meanCents: 0 });

describe("live-notes", () => {
  it("빈 입력", () => {
    const s = liveSummaryFromFrames([], { bpm: 90, beatsPerMeasure: 4 });
    expect(s).toEqual({ measures: [], active: null, totalMeasures: 0, noteCount: 0 });
    expect(liveSummaryFromRaw([], 1, base).measures).toEqual([]);
  });

  it("계이름", () => {
    expect(solfegeName(60)).toBe("도");
    expect(solfegeName(70)).toBe("라#");
  });

  it("확정 음과 쉼표, 마디 묶음 (1초 = 1박)", () => {
    // 도 2박, 쉼 1박, 레 1박 | 미 4박 -> now 는 한참 뒤라 모두 확정
    const s = liveSummaryFromRaw([n(60, 0, 2), n(62, 3, 4), n(64, 4, 8)], 20, base);
    expect(s.active).toBeNull();
    expect(s.measures.map((m) => m.measure)).toEqual([1, 2]);
    expect(s.measures[0].chips.map((c) => c.text)).toEqual(["도 · 2분", "쉼 · 4분", "레 · 4분"]);
    expect(s.measures[1].chips.map((c) => c.text)).toEqual(["미 · 온"]);
    expect(s.noteCount).toBe(3);
  });

  it("진행 중인 음은 칩에서 빠지고 active 로 나온다", () => {
    const s = liveSummaryFromRaw([n(60, 0, 1), n(69, 1, 2.5)], 2.5, base);
    expect(s.active?.text).toBe("라 · 점4분 (진행 중)");
    expect(s.measures.flatMap((m) => m.chips).map((c) => c.text)).toEqual(["도 · 4분"]);
  });

  it("꼬리 쉼표는 표시하지 않고 마지막 N마디만 남긴다", () => {
    const raw = Array.from({ length: 6 }, (_, i) => n(60, i * 4, i * 4 + 4));
    const s = liveSummaryFromRaw(raw, 100, { ...base, maxMeasures: 4 });
    expect(s.measures.map((m) => m.measure)).toEqual([3, 4, 5, 6]);
    expect(s.totalMeasures).toBe(6);
    const short = liveSummaryFromRaw([n(60, 0, 1)], 100, base);
    expect(short.measures[0].chips.map((c) => c.text)).toEqual(["도 · 4분"]);
  });

  it("프레임 경로: 지속 음은 진행 중", () => {
    const hz = 440;
    const frames: PitchFrame[] = Array.from({ length: 60 }, (_, i) => ({ time: i * 0.016, freq: hz, clarity: 0.98 }));
    const s = liveSummaryFromFrames(frames, { bpm: 90, beatsPerMeasure: 4 });
    expect(s.active?.name).toBe("라");
  });
});
