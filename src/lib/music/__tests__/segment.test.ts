import { describe, expect, it } from "vitest";
import { DEFAULT_SEGMENT_OPTIONS, framesToPitchTrack, segmentFrames } from "../segment";
import { frames } from "./helpers";
import { midiToFreq } from "../frequency";

const rep = (v: number | null, n: number) => Array(n).fill(v) as (number | null)[];

describe("segmentFrames", () => {
  it("빈 입력 / 전부 무음 -> 빈 배열", () => {
    expect(segmentFrames([])).toEqual([]);
    expect(segmentFrames(frames(rep(null, 30)))).toEqual([]);
  });
  it("프레임 1개는 음으로 인정 안 됨(너무 짧음)", () => {
    expect(segmentFrames(frames([60]))).toEqual([]);
  });
  it("지속 음 하나 -> 음 하나, 시작/끝/midi", () => {
    const notes = segmentFrames(frames(rep(60, 30)));
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].startSec).toBeCloseTo(0, 6);
    expect(notes[0].endSec).toBeCloseTo(0.5, 2);
    expect(Math.abs(notes[0].meanCents)).toBeLessThan(1e-6);
  });
  it("낮은 clarity 프레임은 무성 취급", () => {
    expect(segmentFrames(frames(rep(60, 30), 1 / 60, 0.5))).toEqual([]);
  });
  it("음성 범위 밖 주파수(<65Hz, >1100Hz)는 무시", () => {
    const f = (hz: number) => Array.from({ length: 30 }, (_, i) => ({ time: i / 60, freq: hz, clarity: 0.99 }));
    expect(segmentFrames(f(50))).toEqual([]);
    expect(segmentFrames(f(1200))).toEqual([]);
    expect(segmentFrames(f(midiToFreq(36)))).toHaveLength(1);
  });
  it("반복음: 2프레임 이상 무성이면 같은 음도 분리", () => {
    const notes = segmentFrames(frames([...rep(67, 15), ...rep(null, 3), ...rep(67, 15)]));
    expect(notes.map((n) => n.midi)).toEqual([67, 67]);
  });
  it("1프레임 끊김은 검출 잡음으로 보고 한 음 유지", () => {
    const notes = segmentFrames(frames([...rep(67, 15), null, ...rep(67, 15)]), { articulationGapSec: 0.05 });
    expect(notes).toHaveLength(1);
  });
  it("다른 음높이는 분리", () => {
    const notes = segmentFrames(frames([...rep(60, 15), ...rep(64, 15)]));
    expect(notes.map((n) => n.midi)).toEqual([60, 64]);
  });
  it("옥타브 튐 1프레임은 중앙값 필터로 제거", () => {
    const spec = rep(60, 30);
    spec[15] = 72;
    expect(segmentFrames(frames(spec)).map((n) => n.midi)).toEqual([60]);
  });
  it("minNoteSec 미만 짧은 음은 제거", () => {
    const notes = segmentFrames(frames([...rep(60, 20), ...rep(null, 5), ...rep(64, 3), ...rep(null, 5), ...rep(60, 20)]));
    expect(notes.every((n) => n.midi === 60)).toBe(true);
  });
  it("시간 오름차순, 겹침 없음", () => {
    const notes = segmentFrames(frames([...rep(60, 10), ...rep(null, 4), ...rep(62, 10), ...rep(64, 10)]));
    for (let i = 1; i < notes.length; i++) expect(notes[i].startSec).toBeGreaterThanOrEqual(notes[i - 1].endSec - 1e-9);
  });
  it("meanCents: +30센트 음 -> 약 30", () => {
    const fr = Array.from({ length: 30 }, (_, i) => ({ time: i / 60, freq: midiToFreq(60) * Math.pow(2, 30 / 1200), clarity: 0.99 }));
    expect(segmentFrames(fr)[0].meanCents).toBeCloseTo(30, 3);
  });
});

describe("framesToPitchTrack", () => {
  it("무성은 null 유지, 길이 동일", () => {
    const t = framesToPitchTrack(frames([60, null, 60]), DEFAULT_SEGMENT_OPTIONS);
    expect(t).toHaveLength(3);
    expect(t[1]).toBeNull();
    expect(t[0]).toBeCloseTo(60, 6);
  });
  it("빈 입력", () => expect(framesToPitchTrack([], DEFAULT_SEGMENT_OPTIONS)).toEqual([]));
});
