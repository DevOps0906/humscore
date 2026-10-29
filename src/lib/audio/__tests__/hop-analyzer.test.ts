import { describe, expect, it } from "vitest";
import { createHopAnalyzer, TRACK_HOP_SEC, type HopBlock } from "../pitch-tracker";
import { OFFLINE_HOP_SEC } from "../offline-pitch";
import type { PitchFrame } from "../../music/types";

const SR = 48000;
const HOP = Math.round(SR * TRACK_HOP_SEC);

/** 사인파를 hop 블록으로 잘라 워클릿 메시지처럼 만든다 */
function blocks(freq: number, count: number, amp: number, startTime = 0): HopBlock[] {
  const out: HopBlock[] = [];
  for (let b = 0; b < count; b++) {
    const samples = new Float32Array(HOP);
    for (let i = 0; i < HOP; i++) samples[i] = amp * Math.sin((2 * Math.PI * freq * (b * HOP + i)) / SR);
    out.push({ samples, endTime: startTime + ((b + 1) * HOP) / SR });
  }
  return out;
}

describe("createHopAnalyzer (워클릿 메시지 → 프레임)", () => {
  it("hop 간격이 0.01초로 고정되고 time은 블록 끝 시각 기준", () => {
    const analyze = createHopAnalyzer(SR, (end) => end - 1);
    const frames = blocks(440, 50, 0.3, 1).map(analyze);
    expect(frames).toHaveLength(50);
    expect(frames[0].time).toBeCloseTo(TRACK_HOP_SEC, 9);
    for (let i = 1; i < frames.length; i++) expect(frames[i].time - frames[i - 1].time).toBeCloseTo(TRACK_HOP_SEC, 9);
  });

  it("time 변환이 거꾸로 가도 단조 증가", () => {
    const times = [0.5, 0.4, 0.6, 0.55];
    let k = 0;
    const analyze = createHopAnalyzer(SR, () => times[k++]);
    const frames = blocks(440, 4, 0.3).map(analyze);
    expect(frames.map((f) => f.time)).toEqual([0.5, 0.5, 0.6, 0.6]);
  });

  it("모든 프레임에 rms를 채운다 — 창이 차면 사인파 진폭/√2, 무음은 0", () => {
    const analyze = createHopAnalyzer(SR, (end) => end);
    const frames: PitchFrame[] = blocks(440, 20, 0.3).map(analyze);
    for (const f of frames) expect(typeof f.rms).toBe("number");
    // 2048 창이 다 찬 뒤(5번째 블록부터)
    for (const f of frames.slice(5)) {
      expect(f.rms!).toBeCloseTo(0.3 / Math.SQRT2, 2);
      expect(Math.abs(f.freq! - 440)).toBeLessThan(3);
    }
    const silent = blocks(440, 10, 0).map(analyze);
    const last = silent[silent.length - 1];
    expect(last.rms).toBe(0);
    expect(last.freq).toBeNull();
  });

  it("오프라인 hop과 같은 상수", () => {
    expect(OFFLINE_HOP_SEC).toBe(TRACK_HOP_SEC);
  });
});
