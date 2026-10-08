import { describe, expect, it } from "vitest";
import { computeLatencySec, outputLatencySec } from "./latency";

describe("computeLatencySec", () => {
  it("출력 지연 + 분석 윈도 + 수동값을 합산", () => {
    const v = computeLatencySec({ outputLatency: 0.1, baseLatency: 0.01, fftSize: 2048, sampleRate: 48000, manualMs: 50 });
    expect(v).toBeCloseTo(0.1 + 1024 / 48000 + 0.05, 6);
  });
  it("outputLatency가 0/undefined면 baseLatency 사용", () => {
    expect(outputLatencySec({ outputLatency: 0, baseLatency: 0.02 })).toBe(0.02);
    expect(outputLatencySec({ baseLatency: 0.02 })).toBe(0.02);
  });
  it("undefined와 NaN은 0으로 처리", () => {
    expect(computeLatencySec({})).toBe(0);
    expect(computeLatencySec({ outputLatency: NaN, baseLatency: NaN, fftSize: NaN, sampleRate: NaN, manualMs: NaN })).toBe(0);
  });
  it("sampleRate가 0이면 윈도 지연은 0", () => {
    expect(computeLatencySec({ fftSize: 2048, sampleRate: 0, manualMs: 100 })).toBeCloseTo(0.1, 6);
  });
});
