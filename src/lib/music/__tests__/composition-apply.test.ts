import { describe, expect, it } from "vitest";
import { applyComposedPhrase } from "../composition-apply";
import { makeScore } from "./helpers";

const phrase = {
  notes: [{ midi: 64, startBeat: 0, durationBeats: 4 }],
  chords: [{ startBeat: 0, symbol: "C" }],
};

describe("작곡 후보 적용", () => {
  it("추가는 마지막 마디 뒤에 정렬하며 기존 절별 가사·코드·진행 기호를 보존한다", () => {
    const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 1, lyric: "가", lyrics: { "1": "가", "2": "나" } }], {
      chords: [{ startBeat: 0, symbol: "Am" }], marks: [{ measure: 0, kind: "fine" }],
    });
    const before = structuredClone(score);
    const patch = applyComposedPhrase(score, phrase, "append");
    expect(patch.notes?.[0]).toEqual(before.notes[0]);
    expect(patch.notes?.[1]).toEqual({ midi: 64, startBeat: 4, durationBeats: 4 });
    expect(patch.chords).toEqual([{ startBeat: 0, symbol: "Am" }, { startBeat: 4, symbol: "C" }]);
    expect({ ...score, ...patch }.marks).toEqual(score.marks);
    expect(score).toEqual(before);
    expect(phrase.notes[0].startBeat).toBe(0);
  });
  it("교체 시 이전 가사·반복·셈여림이 새 멜로디에 남지 않는다", () => {
    const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 1, lyric: "가" }], {
      marks: [{ measure: 0, kind: "repeatStart" }], dynamics: [{ startBeat: 0, kind: "ff" }],
    });
    const patch = applyComposedPhrase(score, phrase, "replace");
    expect(patch.notes).toEqual(phrase.notes);
    expect(patch).toHaveProperty("marks", undefined);
    expect(patch).toHaveProperty("dynamics", undefined);
    expect(score.notes[0].lyric).toBe("가");
  });
  it("빈 악보 추가는 불필요한 첫 빈 마디 없이 0박부터 시작한다", () => {
    expect(applyComposedPhrase(makeScore([]), phrase, "append").notes?.[0].startBeat).toBe(0);
  });
  it("음표 한도를 넘는 추가는 거부한다", () => {
    const score = makeScore(Array.from({ length: 6000 }, (_, i) => ({ midi: 60, startBeat: i, durationBeats: 1 })));
    expect(() => applyComposedPhrase(score, phrase, "append")).toThrow("한도");
  });
});
