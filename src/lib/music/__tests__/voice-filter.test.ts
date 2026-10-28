import { describe, expect, it } from "vitest";
import { classifyVoiceSegment, filterInstrumentFrames } from "../voice-filter";
import { midiToFreq } from "../frequency";
import type { PitchFrame } from "../types";

const DT = 1 / 60;
/** 합성 프레임: 고정 음 + 비브라토(rate Hz, depth 센트) */
function tone(midi: number, sec: number, rate = 0, depth = 0, t0 = 0): PitchFrame[] {
  const out: PitchFrame[] = [];
  for (let i = 0; i * DT < sec; i++) {
    const t = i * DT;
    const c = depth * Math.sin(2 * Math.PI * rate * t);
    out.push({ time: t0 + t, freq: midiToFreq(midi) * Math.pow(2, c / 1200), clarity: 0.97 });
  }
  return out;
}
const silence = (sec: number, t0: number): PitchFrame[] =>
  Array.from({ length: Math.round(sec / DT) }, (_, i) => ({ time: t0 + i * DT, freq: null, clarity: 0.1 }));

describe("classifyVoiceSegment", () => {
  it("6Hz 비브라토 사인 → voice", () => {
    const r = classifyVoiceSegment(tone(67, 1.5, 6, 40));
    expect(r.features.vibrato).toBeGreaterThan(0.3);
    expect(r.label).toBe("voice");
  });
  it("고정 음정 → instrument", () => {
    const r = classifyVoiceSegment([...tone(60, 0.5), ...tone(64, 0.5, 0, 0, 0.5), ...tone(67, 0.5, 0, 0, 1)]);
    expect(r.score).toBeLessThan(0.2);
    expect(r.label).toBe("instrument");
  });
  it("빈 입력 → instrument", () => {
    expect(classifyVoiceSegment([]).label).toBe("instrument");
  });
});

describe("filterInstrumentFrames", () => {
  it("목소리 구간만 무음 처리, 원본 불변", () => {
    const inst = tone(60, 1);
    const gap = silence(0.5, 1);
    const voice = tone(67, 1.5, 6, 40, 1.5);
    const frames = [...inst, ...gap, ...voice];
    const out = filterInstrumentFrames(frames);
    expect(out.slice(0, inst.length).every((f) => f.freq !== null)).toBe(true);
    expect(out.slice(inst.length + gap.length).every((f) => f.freq === null)).toBe(true);
    expect(frames[frames.length - 1].freq).not.toBeNull();
  });
});

describe("글라이드", () => {
  it("음 시작에 아래에서 미끄러져 올라오면 glideRatio 1", () => {
    const f = tone(64, 0.6).map((x, i) => (i < 6 ? { ...x, freq: x.freq! * Math.pow(2, (-150 + i * 25) / 1200) } : x));
    expect(classifyVoiceSegment(f).features.glideRatio).toBe(1);
  });
});
