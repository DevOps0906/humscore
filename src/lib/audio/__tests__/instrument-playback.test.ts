import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPlaybackPlan } from "../../music/playback-plan";
import type { Score } from "../../music/types";
import { playInstrumentNote } from "../instruments";
import { playPlan, playScore } from "../piano-synth";

vi.mock("../instruments", () => ({ playInstrumentNote: vi.fn() }));

function makeContext() {
  const parameter = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({
    gain: parameter(), frequency: parameter(), type: "",
    connect(target: unknown) { return target; }, disconnect() {}, start() {}, stop() {},
  });
  const createOscillator = vi.fn(node);
  const ctx = {
    currentTime: 0, sampleRate: 44100, destination: node(), createGain: node, createOscillator,
  } as unknown as AudioContext;
  return { ctx, createOscillator };
}

function makeScore(extra: Partial<Score> = {}): Score {
  return {
    id: "instrument-playback", title: "음색 재생", bpm: 120, beatsPerMeasure: 4, beatUnit: 4,
    key: { tonic: 0, mode: "major", fifths: 0 },
    notes: [{ midi: 60, startBeat: 0, durationBeats: 1 }, { midi: null, startBeat: 1, durationBeats: 1 }],
    chords: [{ symbol: "C", startBeat: 0 }], transpose: 5, createdAt: "", updatedAt: "", ...extra,
  };
}

beforeEach(() => vi.clearAllMocks());

for (const method of ["playScore", "playPlan"] as const) {
  const play = (ctx: AudioContext, score: Score, options: Parameters<typeof playScore>[2] = {}) =>
    method === "playScore" ? playScore(ctx, score, options) : playPlan(ctx, buildPlaybackPlan(score), options);

  describe(`${method} 악기 선택과 무음정 타악기 재생`, () => {
    it("저장한 일렉피아노 음색과 선율 전조를 사용한다", () => {
      const { ctx } = makeContext();
      play(ctx, makeScore({ notation: "piano", instrument: "epRhodes" }), { withChords: false });
      expect(playInstrumentNote).toHaveBeenCalledTimes(1);
      expect(playInstrumentNote).toHaveBeenCalledWith(ctx, "epRhodes", 65, 0.1, expect.objectContaining({ duration: 0.5 }));
    });

    it("명시적으로 지정한 음색이 저장된 음색보다 우선한다", () => {
      const { ctx } = makeContext();
      play(ctx, makeScore({ instrument: "epRhodes" }), { instrument: "violin", withChords: false });
      expect(playInstrumentNote).toHaveBeenCalledWith(ctx, "violin", 65, 0.1, expect.any(Object));
    });

    it("기존 악보는 피아노로 재생하고 코드 반주는 유지한다", () => {
      const { ctx, createOscillator } = makeContext();
      play(ctx, makeScore());
      expect(playInstrumentNote).toHaveBeenCalledWith(ctx, "piano", 65, 0.1, expect.any(Object));
      expect(createOscillator).toHaveBeenCalled();
    });

    for (const instrument of [undefined, "drumKit"] as const) {
      it(`드럼 ${instrument ?? "기본 음색"}은 전조와 코드 반주를 적용하지 않는다`, () => {
        const { ctx, createOscillator } = makeContext();
        const source = makeScore({ notation: "drums", instrument, notes: [{ midi: 38, startBeat: 0, durationBeats: 1 }] });
        play(ctx, source, { withChords: true });
        expect(playInstrumentNote).toHaveBeenCalledTimes(1);
        expect(playInstrumentNote).toHaveBeenCalledWith(ctx, "drumKit", 38, 0.1, expect.any(Object));
        expect(createOscillator).not.toHaveBeenCalled();
      });
    }

    it("오케스트라 트라이앵글도 고정 타악기 라우팅 전에 전조하지 않는다", () => {
      const { ctx, createOscillator } = makeContext();
      play(ctx, makeScore({ notation: "orchestra", instrument: "triangle" }), { withChords: true });
      expect(playInstrumentNote).toHaveBeenCalledTimes(1);
      expect(playInstrumentNote).toHaveBeenCalledWith(ctx, "triangle", 60, 0.1, expect.any(Object));
      expect(createOscillator).not.toHaveBeenCalled();
    });
  });
}
