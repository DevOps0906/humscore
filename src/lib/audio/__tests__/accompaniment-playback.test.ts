import { describe, expect, it } from "vitest";
import { playPlan, playScore } from "../piano-synth";
import { buildPlaybackPlan } from "../../music/playback-plan";
import { makeScore } from "../../music/__tests__/helpers";

function context() {
  const starts: number[] = [];
  const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ gain: param(), frequency: param(), connect() {}, disconnect() {}, start(time: number) { starts.push(time); }, stop() {} });
  return { starts, ctx: { currentTime: 0, sampleRate: 44100, destination: node(), createGain: node, createOscillator: node } as unknown as AudioContext };
}
const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 4 }], {
  bpm: 120, chords: [{ symbol: "C", startBeat: 0 }], accompaniment: { mode: "arpeggio", pattern: "ascending" },
});
const onsets = (starts: number[]) => [...new Set(starts)];

describe("반주 예약", () => {
  it("전체 재생과 공연 재생이 같은 8분음표 시점에 반주를 예약한다", () => {
    const a = context();
    const b = context();
    playScore(a.ctx, score);
    playPlan(b.ctx, buildPlaybackPlan(score));
    expect(onsets(a.starts)).toEqual(onsets(b.starts));
    expect(onsets(a.starts)).toHaveLength(8);
    expect(onsets(a.starts)[1]).toBeCloseTo(0.35);
    expect(onsets(a.starts).at(-1)).toBeCloseTo(1.85);
  });
  it("재생 재개와 속도 변경에도 패턴 위상과 끝 경계를 유지한다", () => {
    const a = context();
    playPlan(a.ctx, buildPlaybackPlan(score), { fromBeat: 0.75, rate: 0.5, at: 2 });
    expect(onsets(a.starts)[0]).toBe(2);
    expect(onsets(a.starts)[1]).toBe(2.25);
    expect(onsets(a.starts).at(-1)).toBe(4.75);
    expect(onsets(a.starts).every((time) => time < 5.25)).toBe(true);
  });
  it("반주를 끄면 선율 시작만 예약한다", () => {
    const a = context();
    playScore(a.ctx, score, { withChords: false });
    expect(onsets(a.starts)).toEqual([0.1]);
  });
});
