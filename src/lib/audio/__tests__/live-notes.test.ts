import { describe, expect, it } from "vitest";
import { createLiveFramesCache, liveSummaryFromFrames, liveSummaryFromRaw, liveSummaryIncremental, solfegeName } from "../live-notes";
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

/** 결정적 의사난수 */
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

/** 노래 합성: 음(0.3~2초)과 쉼(대부분 짧고 가끔 1.5~3초)을 이어 16ms 프레임으로 */
function synth(seconds: number, seed: number, longRests: boolean): PitchFrame[] {
  const r = rng(seed);
  const frames: PitchFrame[] = [];
  const dt = 0.016;
  let t = 0;
  while (t < seconds) {
    const midi = 55 + Math.floor(r() * 14);
    const dur = 0.3 + r() * 1.7;
    const hz = 440 * 2 ** ((midi - 69) / 12);
    for (let u = 0; u < dur && t < seconds; u += dt, t += dt) {
      frames.push({ time: t, freq: hz * (1 + (r() - 0.5) * 0.006), clarity: 0.97 });
    }
    const rest = longRests && r() < 0.4 ? 1.5 + r() * 1.5 : 0.1 + r() * 0.3;
    for (let u = 0; u < rest && t < seconds; u += dt, t += dt) frames.push({ time: t, freq: null, clarity: 0 });
  }
  return frames;
}

describe("liveSummaryIncremental", () => {
  for (const [seconds, longRests, bpm, beats] of [
    [8, true, 90, 4],
    [40, true, 100, 4],
    [90, true, 70, 3],
    [60, false, 120, 4],
    [120, true, 150, 3],
  ] as const) {
    it(`전체 처리와 일치: ${seconds}초, 긴 쉼 ${longRests}, ${bpm}BPM, ${beats}박`, () => {
      for (const seed of [1, 2, 3, 4]) {
      const frames = synth(seconds, seconds * 7 + bpm + seed * 101, longRests);
      const opts = { bpm, beatsPerMeasure: beats } as const;
      let cache = createLiveFramesCache();
      const step = Math.round(0.28 / 0.016);
      let committedSeen = false;
      for (let n = step; n <= frames.length + step; n += step) {
        const part = frames.slice(0, Math.min(n, frames.length));
        const inc = liveSummaryIncremental(part, opts, cache);
        cache = inc.cache;
        if (cache.frameIdx > 0) committedSeen = true;
        expect(inc.summary).toEqual(liveSummaryFromFrames(part, opts));
      }
      if (longRests && seconds >= 40) expect(committedSeen).toBe(true);
      }
    }, 60_000);
  }
});
