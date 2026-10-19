import { describe, expect, it } from "vitest";
import { segmentFrames } from "../segment";
import { quantizeNotes, snapBeat } from "../quantize";
import { buildScoreFromFrames, buildScoreFromRawNotes } from "../pipeline";
import { midiToFreq } from "../frequency";
import type { PitchFrame, RawNote } from "../types";
import { frames } from "./helpers";

const rep = (v: number | null, n: number) => Array(n).fill(v) as (number | null)[];
const raw = (midi: number | null, s: number, e: number): RawNote => ({ midi, startSec: s, endSec: e, meanCents: 0 });
const q = (r: RawNote[], bpm = 100, grid = 0.25) => quantizeNotes(r, { bpm, beatsPerMeasure: 4, grid });
const spb = 0.6; // 100 bpm

describe("segment: 놓는 지점", () => {
  it("신뢰도만 잠깐 떨어지고 주파수는 유지되는 40ms 드롭아웃은 한 음", () => {
    const f: PitchFrame[] = frames(rep(67, 40));
    for (const i of [20, 21]) f[i] = { ...f[i], clarity: 0.2 };
    const notes = segmentFrames(f);
    expect(notes).toHaveLength(1);
    expect(notes[0].endSec).toBeCloseTo(40 / 60, 2);
  });
  it("성대가 멈춘 시점이 음 끝", () => {
    const notes = segmentFrames(frames([...rep(60, 30), ...rep(null, 30)]));
    expect(notes).toHaveLength(1);
    expect(notes[0].endSec).toBeCloseTo(0.5, 2);
  });
  it("무음으로 갈린 두 음 -> 음, 틈, 음 (양자화하면 음 쉼표 음)", () => {
    const notes = segmentFrames(frames([...rep(60, 30), ...rep(null, 30), ...rep(62, 30)]));
    expect(notes.map((n) => n.midi)).toEqual([60, 62]);
    expect(notes[1].startSec - notes[0].endSec).toBeCloseTo(0.5, 1);
    const sc = quantizeNotes(notes, { bpm: 120, beatsPerMeasure: 4, grid: 0.25 });
    expect(sc.map((x) => x.midi)).toEqual([60, null, 62, null]);
    expect(sc[1].durationBeats).toBe(1);
  });
});

describe("segment: range 옵션", () => {
  const f = (hz: number) => Array.from({ length: 30 }, (_, i) => ({ time: i / 60, freq: hz, clarity: 0.99 }));
  it("voice(기본)는 피아노 저음/고음을 거름, instrument 는 A0~C8 허용", () => {
    expect(segmentFrames(f(midiToFreq(24)))).toEqual([]);
    expect(segmentFrames(f(midiToFreq(96)))).toEqual([]);
    expect(segmentFrames(f(midiToFreq(24)), { range: "instrument" })).toHaveLength(1);
    expect(segmentFrames(f(midiToFreq(96)), { range: "instrument" })).toHaveLength(1);
  });
  it("instrument 범위 밖(A0 아래, C8 위)은 거름", () => {
    expect(segmentFrames(f(20), { range: "instrument" })).toEqual([]);
    expect(segmentFrames(f(5000), { range: "instrument" })).toEqual([]);
  });
  it("instrument 기본 신뢰도는 더 엄격, 직접 지정하면 그 값", () => {
    const low = Array.from({ length: 30 }, (_, i) => ({ time: i / 60, freq: 440, clarity: 0.9 }));
    expect(segmentFrames(low)).toHaveLength(1);
    expect(segmentFrames(low, { range: "instrument" })).toEqual([]);
    expect(segmentFrames(low, { range: "instrument", minClarity: 0.88 })).toHaveLength(1);
  });
  it("buildScoreFromFrames 에 range 전달", () => {
    const fr = f(midiToFreq(96));
    expect(buildScoreFromFrames(fr, { bpm: 120, beatsPerMeasure: 4 }).score.notes.every((x) => x.midi === null)).toBe(true);
    expect(buildScoreFromFrames(fr, { bpm: 120, beatsPerMeasure: 4, range: "instrument" }).score.notes.some((x) => x.midi === 96)).toBe(true);
  });
});

describe("quantize: 길이/legato/쉼표", () => {
  it("100bpm 에서 0.92박 유지한 4분음표 -> 4분음표", () => {
    const r = q([raw(60, 0, 0.92 * spb), raw(62, 1 * spb, 2 * spb)]).filter((x) => x.midi !== null);
    expect(r[0]).toEqual({ midi: 60, startBeat: 0, durationBeats: 1 });
  });
  it("작은 틈(숨)은 붙임: 앞 음이 다음 시작까지 연장", () => {
    const r = q([raw(60, 0, 0.8 * spb), raw(62, 0.9 * spb, 2 * spb)]).filter((x) => x.midi !== null);
    expect(r[0].startBeat + r[0].durationBeats).toBe(r[1].startBeat);
  });
  it("진짜 1박 틈 -> 4분쉼표", () => {
    const r = q([raw(60, 0, 1 * spb), raw(62, 2 * spb, 3 * spb)]);
    expect(r.map((x) => [x.midi, x.startBeat, x.durationBeats])).toEqual([
      [60, 0, 1],
      [null, 1, 1],
      [62, 2, 1],
      [null, 3, 1],
    ]);
  });
  it("시작/끝 모두 격자에 스냅, 최소 1격자, 박 쪽 편향", () => {
    expect(q([raw(60, 0.04 * spb, 0.51 * spb)])[0]).toMatchObject({ startBeat: 0, durationBeats: 0.5 });
    expect(q([raw(60, 0, 0.01 * spb)])[0].durationBeats).toBe(0.25);
    expect(snapBeat(1.09, 0.25)).toBe(1);
    expect(snapBeat(1.13, 0.25)).toBe(1.25);
    expect(snapBeat(0.92, 0.25)).toBe(1);
  });
  it("최소 길이로 늘어난 앞 음은 다음 음 시작에서 잘림", () => {
    const r = q([raw(60, 0, 0.02 * spb), raw(62, 0.1 * spb, 1 * spb)]).filter((x) => x.midi !== null);
    expect(r[0].startBeat + r[0].durationBeats).toBeLessThanOrEqual(r[1].startBeat + 1e-9);
  });
});

describe("buildScoreFromRawNotes (MIDI 건반 녹음)", () => {
  it("정확한 on/off 시각 -> 양자화된 Score", () => {
    // 120bpm: 1박 0.5초. C4 1박, D4 2박(붙여서), 쉼 1박, E4 4분음표
    const { score } = buildScoreFromRawNotes([raw(60, 0, 0.5), raw(62, 0.5, 1.5), raw(64, 2, 2.5)], { bpm: 120, beatsPerMeasure: 4, title: "kbd" });
    expect(score.title).toBe("kbd");
    expect(score.notes.map((x) => [x.midi, x.startBeat, x.durationBeats])).toEqual([
      [60, 0, 1],
      [62, 1, 2],
      [null, 3, 1],
      [64, 4, 1],
      [null, 5, 3],
    ]);
    expect(score.chords.length).toBe(2);
    expect(score.transpose).toBe(0);
  });
  it("빈 입력과 기본 제목", () => {
    const { score } = buildScoreFromRawNotes([], { bpm: 100, beatsPerMeasure: 3 });
    expect(score.notes).toEqual([{ midi: null, startBeat: 0, durationBeats: 3 }]);
    expect(score.title.length).toBeGreaterThan(0);
  });
});
