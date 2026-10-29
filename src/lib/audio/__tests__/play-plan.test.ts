import { describe, expect, it } from "vitest";
import { buildPlaybackPlan } from "../../music/playback-plan";
import type { NoteEvent, Score } from "../../music/types";
import { playPlan } from "../piano-synth";

/** osc 시작 시각만 기록하는 가짜 AudioContext */
function makeCtx() {
  const starts: number[] = [];
  const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (kind: string) => ({
    kind,
    gain: param(),
    frequency: param(),
    detune: param(),
    Q: param(),
    type: "",
    connect(t: unknown) { return t; },
    disconnect() {},
    start(t: number) { if (kind === "osc") starts.push(t); },
    stop() {},
  });
  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    destination: node("destination"),
    createGain: () => node("gain"),
    createOscillator: () => node("osc"),
  };
  return { ctx: ctx as unknown as AudioContext, starts };
}

const n = (midi: number | null, startBeat: number, durationBeats = 1): NoteEvent => ({ midi, startBeat, durationBeats });
function mk(notes: NoteEvent[], extra: Partial<Score> = {}): Score {
  return { id: "t", title: "t", bpm: 120, beatsPerMeasure: 4, beatUnit: 4, key: { tonic: 0, mode: "major", fifths: 0 }, notes, chords: [], transpose: 0, createdAt: "", updatedAt: "", ...extra };
}
/** 음마다 첫 osc 시작 시각(배음 6개가 같은 시각에 시작) */
const onsets = (starts: number[]) => [...new Set(starts)].sort((a, b) => a - b);

describe("playPlan", () => {
  const score = mk([n(60, 0), n(62, 1), n(64, 2), n(null, 3), n(65, 4)]);

  it("A4: 속도 70% 예약 간격 = 100% 대비 1/0.7배", () => {
    const plan = buildPlaybackPlan(score);
    const a = makeCtx();
    const b = makeCtx();
    const full = playPlan(a.ctx, plan, { rate: 1, at: 1 });
    const slow = playPlan(b.ctx, plan, { rate: 0.7, at: 1 });
    const fa = onsets(a.starts);
    const fb = onsets(b.starts);
    expect(fa).toHaveLength(4); // 쉼표 제외
    for (let i = 1; i < fa.length; i++) expect((fb[i] - fb[0]) / (fa[i] - fa[0])).toBeCloseTo(1 / 0.7, 6);
    expect(slow.durationSec / full.durationSec).toBeCloseTo(1 / 0.7, 6);
    expect(full.secondsPerBeat).toBeCloseTo(0.5, 6);
  });

  it("fromBeat 이후 음만 at 시각 기준으로 예약", () => {
    const { ctx, starts } = makeCtx();
    const pb = playPlan(ctx, buildPlaybackPlan(score), { fromBeat: 2, at: 10 });
    expect(onsets(starts)).toEqual([10, 11]); // 박 2(64)·박 4(65), 120bpm → 박당 0.5초
    expect(pb.fromBeat).toBe(2);
    expect(pb.durationSec).toBeCloseTo(1.5, 6);
  });

  it("마지막 코드는 계획 끝(totalBeats)까지만, fromBeat 에 걸친 코드는 fromBeat 부터", () => {
    const s = mk([n(60, 0, 8)], { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }] });
    const { ctx, starts } = makeCtx();
    playPlan(ctx, buildPlaybackPlan(s, { startMeasure: 1, endMeasure: 1 }), { fromBeat: 1, at: 0, withChords: true });
    // 멜로디 음(박 0)은 fromBeat 이전이라 제외, 구간 밖 G 코드 없음, C 코드만 박 1 시각(0초)에
    expect(onsets(starts)).toEqual([0]);
  });

  it("음수 박 셈여림(구간 앞에서 이어받은 헤어핀)은 음량 계산에만 쓰고 예약 시각에 쓰지 않는다", () => {
    const base = buildPlaybackPlan(score);
    const plan = { ...base, dynamics: [{ startBeat: -2, kind: "cresc" as const, durationBeats: 4 }, { startBeat: 2, kind: "f" as const }] };
    const a = makeCtx();
    const b = makeCtx();
    playPlan(a.ctx, base, { at: 1 });
    playPlan(b.ctx, plan, { at: 1 });
    expect(onsets(b.starts)).toEqual(onsets(a.starts));
    expect(Math.min(...b.starts)).toBeGreaterThanOrEqual(1);
  });
});
