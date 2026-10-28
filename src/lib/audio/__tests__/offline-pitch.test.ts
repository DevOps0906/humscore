import { describe, expect, it } from "vitest";
import { AudioLimitError, decodeAudioFile, framesFromSamples, MAX_AUDIO_BYTES, mixToMono, OFFLINE_HOP_SEC } from "../offline-pitch";

const SR = 44100;
function sine(freq: number, sec: number, amp = 0.3): Float32Array {
  const out = new Float32Array(Math.round(SR * sec));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

describe("offline-pitch", () => {
  it("사인파의 주파수를 프레임으로 찾는다", async () => {
    const frames = await framesFromSamples(sine(440, 1), SR);
    expect(frames.length).toBeGreaterThan(50);
    const voiced = frames.filter((f) => f.freq !== null && f.clarity > 0.9);
    expect(voiced.length / frames.length).toBeGreaterThan(0.9);
    for (const f of voiced) expect(Math.abs(f.freq! - 440)).toBeLessThan(3);
    expect(frames[1].time - frames[0].time).toBeCloseTo(OFFLINE_HOP_SEC, 2);
  });

  it("무음은 무성 프레임", async () => {
    const frames = await framesFromSamples(new Float32Array(SR / 2), SR);
    expect(frames.every((f) => f.freq === null)).toBe(true);
  });

  it("채널 평균으로 모노 변환", () => {
    expect(Array.from(mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });

  it("취소 신호가 오면 분석 루프를 즉시 중단한다", async () => {
    const ac = new AbortController();
    let calls = 0;
    const p = framesFromSamples(sine(440, 60), SR, () => {
      if (++calls === 1) ac.abort();
    }, ac.signal);
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(1);
  });

  it("이미 취소된 신호면 시작하지 않는다", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(framesFromSamples(sine(440, 1), SR, undefined, ac.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("크기 상한을 넘는 파일은 읽기 전에 거부", async () => {
    const big = { size: MAX_AUDIO_BYTES + 1, arrayBuffer: () => Promise.reject(new Error("읽으면 안 됨")) } as unknown as Blob;
    await expect(decodeAudioFile(big)).rejects.toBeInstanceOf(AudioLimitError);
    await expect(decodeAudioFile(big)).rejects.toMatchObject({ reason: "bytes" });
  });
});
