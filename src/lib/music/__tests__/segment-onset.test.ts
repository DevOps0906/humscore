import { describe, expect, it } from "vitest";
import { frameInterval, ONSET_MIN_RMS, segmentFrames } from "../segment";
import { midiToFreq } from "../frequency";
import type { PitchFrame } from "../types";

/**
 * 같은 음 반복을 끊김 없이(주파수 계속 검출) 세기만 줄였다 키우는 합성 프레임.
 * 각 음: 앞 70% 는 큰 세기, 뒤 30% 는 작은 세기(골). withRms=false 면 rms 를 비움
 */
function repeated(midi: number, count: number, noteSec: number, fps: number, withRms = true): PitchFrame[] {
  const dt = 1 / fps;
  const out: PitchFrame[] = [];
  const total = count * noteSec;
  for (let i = 0; i * dt < total - 1e-9; i++) {
    const t = i * dt;
    const pos = (t % noteSec) / noteSec;
    const f: PitchFrame = { time: t, freq: midiToFreq(midi), clarity: 0.97 };
    if (withRms) f.rms = pos < 0.7 ? 0.2 : 0.03;
    out.push(f);
  }
  return out;
}

const SIXTEENTH_120 = 0.125; // 120bpm 16분음표

describe("segmentFrames: 세기 온셋", () => {
  it("100fps 120bpm 16분음표 같은 음 8개 -> 8음으로 분리", () => {
    const notes = segmentFrames(repeated(67, 8, SIXTEENTH_120, 100));
    expect(notes.map((n) => n.midi)).toEqual(Array(8).fill(67));
    notes.forEach((n, i) => expect(n.startSec).toBeCloseTo(i * SIXTEENTH_120, 1));
  });
  it("60fps 와 100fps 결과가 같음 (음 수·음높이, 시작 시각은 1프레임 이내)", () => {
    const a = segmentFrames(repeated(67, 8, SIXTEENTH_120, 60));
    const b = segmentFrames(repeated(67, 8, SIXTEENTH_120, 100));
    expect(a.map((n) => n.midi)).toEqual(b.map((n) => n.midi));
    a.forEach((n, i) => expect(Math.abs(n.startSec - b[i].startSec)).toBeLessThanOrEqual(1 / 60 + 1e-6));
  });
  it("rms 가 없으면 기존처럼 한 음", () => {
    expect(segmentFrames(repeated(67, 8, SIXTEENTH_120, 100, false))).toHaveLength(1);
  });
  it("발성 시작의 세기 상승만으로는 분리하지 않음", () => {
    const f: PitchFrame[] = Array.from({ length: 50 }, (_, i) => ({
      time: i / 100,
      freq: midiToFreq(60),
      clarity: 0.97,
      rms: Math.min(0.2, 0.005 * 1.5 ** i),
    }));
    expect(segmentFrames(f)).toHaveLength(1);
  });
  it("ONSET_MIN_RMS 미만의 작은 요동은 무시", () => {
    const f = repeated(67, 4, SIXTEENTH_120, 100).map((x) => ({ ...x, rms: (x.rms ?? 0) * (ONSET_MIN_RMS / 0.4) }));
    expect(segmentFrames(f)).toHaveLength(1);
  });
});

describe("segmentFrames: 프레임 간격 무관", () => {
  const spec = (fps: number, gapSec: number) => {
    const out: PitchFrame[] = [];
    const n = Math.round(0.5 * fps);
    const g = Math.round(gapSec * fps);
    for (let i = 0; i < n * 2 + g; i++) {
      const silent = i >= n && i < n + g;
      out.push({ time: i / fps, freq: silent ? null : midiToFreq(67), clarity: silent ? 0.1 : 0.97 });
    }
    return out;
  };
  it("50ms 끊김: 60fps·100fps 모두 반복음 2개", () => {
    expect(segmentFrames(spec(60, 0.05))).toHaveLength(2);
    expect(segmentFrames(spec(100, 0.05))).toHaveLength(2);
  });
  it("1프레임(60fps 기준 17ms) 이하 끊김: 60fps·100fps 모두 한 음", () => {
    expect(segmentFrames(spec(60, 1 / 60), { articulationGapSec: 0.05 })).toHaveLength(1);
    expect(segmentFrames(spec(100, 0.01), { articulationGapSec: 0.05 })).toHaveLength(1);
  });
  it("100fps 옥타브 튐 1프레임도 중앙값 필터로 제거", () => {
    const f = spec(100, 0).map((x, i) => (i === 25 ? { ...x, freq: midiToFreq(79) } : x));
    expect(segmentFrames(f).map((n) => n.midi)).toEqual([67]);
  });
  it("frameInterval: 시간 차 중앙값", () => {
    expect(frameInterval([])).toBeCloseTo(1 / 60, 9);
    expect(frameInterval(spec(100, 0))).toBeCloseTo(0.01, 9);
  });
});

describe("segmentFrames: 회귀", () => {
  it("100fps 정확히 60ms(minNoteSec) 음 20개 C4/D4 교대 -> 20음 (부동소수 경계)", () => {
    const f: PitchFrame[] = Array.from({ length: 120 }, (_, i) => ({
      time: i * 0.01,
      freq: midiToFreq(Math.floor(i / 6) % 2 ? 62 : 60),
      clarity: 0.97,
    }));
    expect(segmentFrames(f, { medianWindow: 1 }).map((n) => n.midi)).toEqual(
      Array.from({ length: 20 }, (_, k) => (k % 2 ? 62 : 60)),
    );
  });
  it("드롭아웃으로 유지된 같은 음은 세기 복귀로 다시 나누지 않음 (40ms 저신뢰 구간 rms 0.1→0.02→0.1)", () => {
    const f: PitchFrame[] = Array.from({ length: 100 }, (_, i) => {
      const drop = i >= 50 && i < 54;
      return { time: i * 0.01, freq: midiToFreq(67), clarity: drop ? 0.5 : 0.97, rms: drop ? 0.02 : 0.1 };
    });
    expect(segmentFrames(f)).toHaveLength(1);
  });
});

