import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeScore } from "../../music/__tests__/helpers";
import { buildPlaybackPlan } from "../../music/playback-plan";
import { playPlan, playScore } from "../piano-synth";

const play = vi.hoisted(() => vi.fn());
vi.mock("../instruments", () => ({ playInstrumentNote: play }));

function context() {
  const buses: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const ctx = { currentTime: 3, destination: {}, createGain() {
    const bus = { gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    buses.push(bus); return bus;
  } } as unknown as AudioContext;
  return { ctx, buses };
}

beforeEach(() => play.mockClear());
describe("악기별 합주 예약", () => {
  const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 1, tieToNext: true }, { midi: 60, startBeat: 1, durationBeats: 1 }], { instrument: "piano", notation: "piano", transpose: 2,
    parts: [
      { id: "bass", instrument: "bassGuitar5", notation: "guitarTab", notes: [{ midi: 28, startBeat: 0, durationBeats: 8 }], chords: [] },
      { id: "drums", instrument: "drumKit", notation: "drums", notes: [{ midi: 36, startBeat: 0, durationBeats: 1 }], chords: [] },
    ],
  });
  it("동시에 시작하고 베이스의 저음과 드럼의 고정 음번호를 유지한다", () => {
    const { ctx } = context();
    const playback = playScore(ctx, score, { withChords: false });
    expect(play.mock.calls.map((call) => [call[1], call[2], call[3]])).toEqual([["piano", 62, 3.1], ["bassGuitar5", 30, 3.1], ["drumKit", 36, 3.1]]);
    expect(play.mock.calls[0][4].duration).toBe(1);
    expect(playback.durationSec).toBe(4);
  });
  it("공연 모드 속도·시작 시각을 공유하고 정지하면 모든 버스를 해제한다", () => {
    vi.useFakeTimers();
    try {
      const { ctx, buses } = context();
      const playback = playPlan(ctx, buildPlaybackPlan(score), { rate: 0.5, at: 10, withChords: false });
      expect(play.mock.calls.every((call) => call[3] === 10)).toBe(true);
      expect(playback.durationSec).toBe(8);
      playback.stop(); vi.runAllTimers();
      expect(buses).toHaveLength(3);
      expect(buses.every((bus) => bus.disconnect.mock.calls.length === 1)).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it("붙임줄 중간에서 재개하면 남은 길이를 다시 예약한다", () => {
    const { ctx } = context();
    playPlan(ctx, buildPlaybackPlan(score), { fromBeat: 1, at: 5, withChords: false });
    expect(play.mock.calls[0][1]).toBe("piano");
    expect(play.mock.calls[0][3]).toBe(5);
    expect(play.mock.calls[0][4].duration).toBe(0.5);
  });
});
