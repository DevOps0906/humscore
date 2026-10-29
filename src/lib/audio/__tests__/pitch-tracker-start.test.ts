import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** startPitchTracking 시작 대기 중 취소·워클릿 로드 시간 초과 (브라우저 API는 목) */

const ctxMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../context", () => ({
  getAudioContext: () => ctxMock.current,
  setAudioSessionType: () => {},
}));
vi.mock("../click-scheduler", () => ({ startClickScheduler: () => () => {} }));

import { startPitchTracking, WORKLET_LOAD_TIMEOUT_MS } from "../pitch-tracker";

function setup(addModule: () => Promise<void>) {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track] };
  const analyser = { fftSize: 0, getFloatTimeDomainData: vi.fn() };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const ctx = {
    state: "running",
    sampleRate: 48000,
    currentTime: 0,
    outputLatency: 0,
    baseLatency: 0,
    audioWorklet: { addModule: vi.fn(addModule) },
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
    destination: {},
  };
  ctxMock.current = ctx;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  vi.stubGlobal("AudioWorkletNode", class {});
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return { track, ctx };
}

const OPTS = { bpm: 120, beatsPerMeasure: 4, countInMeasures: 0, metronome: false };

describe("startPitchTracking 시작 대기", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("워클릿 로드 대기 중 취소하면 마이크 트랙을 끄고 AbortError로 reject", async () => {
    const { track, ctx } = setup(() => new Promise(() => {})); // 끝나지 않는 로드
    const ac = new AbortController();
    const p = startPitchTracking({ ...OPTS, signal: ac.signal });
    await vi.advanceTimersByTimeAsync(10);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(track.stop).toHaveBeenCalled();
    expect(ctx.createMediaStreamSource).not.toHaveBeenCalled();
  });

  it("워클릿 로드가 제한 시간을 넘으면 analyser(rAF) 경로로 폴백", async () => {
    const { track, ctx } = setup(() => new Promise(() => {}));
    const p = startPitchTracking(OPTS);
    await vi.advanceTimersByTimeAsync(WORKLET_LOAD_TIMEOUT_MS + 1);
    const s = await p;
    expect(ctx.createAnalyser).toHaveBeenCalled();
    expect(track.stop).not.toHaveBeenCalled();
    s.stop();
    expect(track.stop).toHaveBeenCalled();
  });

  it("이미 취소된 신호면 마이크를 요청하지 않는다", async () => {
    setup(() => Promise.resolve());
    const ac = new AbortController();
    ac.abort();
    await expect(startPitchTracking({ ...OPTS, signal: ac.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect((navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
