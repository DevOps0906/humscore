import { describe, expect, it } from "vitest";
import type { Score } from "../music/types";
import { MAX_SCORE_BYTES, parseScore, scoreBytes, scoreSchema } from "./score-schema";

const base = (): Score => ({
  id: "3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c", title: "가".repeat(200), bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("score-schema", () => {
  it("정상 Score 통과, ISO 가 아닌 날짜는 거부", () => {
    expect(parseScore(base())).not.toBeNull();
    expect(parseScore({ ...base(), updatedAt: "Jan 1 2026" })).toBeNull();
    expect(parseScore({ ...base(), updatedAt: "2026-01-01" })).toBeNull();
  });
  it("최대 크기 Score 도 Server Action 한도(1MB)보다 충분히 작다", () => {
    const long = 29999.999999999996; // 최악에 가까운 자릿수
    const max: Score = {
      ...base(),
      notes: Array.from({ length: 6_000 }, () => ({ midi: 108, startBeat: long, durationBeats: long })),
      chords: Array.from({ length: 1_500 }, () => ({ startBeat: long, symbol: "F#m7b5/C#" })),
    };
    expect(scoreSchema.safeParse(max).success).toBe(true);
    expect(scoreBytes(max)).toBeLessThan(MAX_SCORE_BYTES);
  });
  it("상한 초과는 거부", () => {
    const over = { ...base(), notes: Array.from({ length: 6_001 }, () => ({ midi: 60, startBeat: 0, durationBeats: 1 })) };
    expect(scoreSchema.safeParse(over).success).toBe(false);
  });
});
