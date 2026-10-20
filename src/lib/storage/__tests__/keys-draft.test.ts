import { describe, expect, it } from "vitest";
import { parseKeysDraft, serializeKeysDraft, type KeysDraft } from "../keys-draft";

const note = { midi: 60, startBeat: 0, durationBeats: 1 };

describe("keys-draft", () => {
  it("잘못된 JSON / 빈 값 / notes 없음은 null", () => {
    expect(parseKeysDraft(null)).toBeNull();
    expect(parseKeysDraft("{oops")).toBeNull();
    expect(parseKeysDraft("123")).toBeNull();
    expect(parseKeysDraft(JSON.stringify({ bpm: 90 }))).toBeNull();
  });

  it("구버전(beatsPerMeasure 만) 복원: 3 → 3/4, 그 외 → 4/4, 조는 C 장조", () => {
    const a = parseKeysDraft(JSON.stringify({ notes: [note], bpm: 100, beatsPerMeasure: 3 }))!;
    expect(a.meter).toBe("3/4");
    expect(a.key).toEqual({ tonic: 0, mode: "major", fifths: 0 });
    expect(a.progressionId).toBe("auto");
    expect(a.bpm).toBe(100);
    expect(parseKeysDraft(JSON.stringify({ notes: [], beatsPerMeasure: 4 }))!.meter).toBe("4/4");
    expect(parseKeysDraft(JSON.stringify({ notes: [], beatsPerMeasure: 5 }))!.meter).toBe("4/4");
  });

  it("notes 원소가 하나라도 손상되면 초안 전체 폐기", () => {
    const bad = [
      { midi: 200, startBeat: 0, durationBeats: 1 },
      { midi: 60, startBeat: -1, durationBeats: 1 },
      { midi: 60, startBeat: 0 },
      { midi: "60", startBeat: 0, durationBeats: 1 },
      null,
    ];
    for (const b of bad) {
      expect(parseKeysDraft(JSON.stringify({ notes: [note, b] }))).toBeNull();
    }
    // 쉼표(midi null)는 유효
    expect(parseKeysDraft(JSON.stringify({ notes: [{ midi: null, startBeat: 1, durationBeats: 1 }] }))).not.toBeNull();
  });

  it("bpm 은 30~240 으로 clamp, 비정상 값은 90", () => {
    const bpm = (v: unknown) => parseKeysDraft(JSON.stringify({ notes: [], bpm: v }))!.bpm;
    expect(bpm(5)).toBe(30);
    expect(bpm(999)).toBe(240);
    expect(bpm(120)).toBe(120);
    expect(bpm(-3)).toBe(90);
    expect(bpm("x")).toBe(90);
  });

  it("meter 가 있으면 그대로 (6/8 포함)", () => {
    expect(parseKeysDraft(JSON.stringify({ notes: [], meter: "6/8", beatsPerMeasure: 3 }))!.meter).toBe("6/8");
  });

  it("조와 코드 진행이 저장/복원에서 보존됨", () => {
    const d: KeysDraft = {
      notes: [note],
      bpm: 80,
      meter: "6/8",
      key: { tonic: 9, mode: "minor", fifths: 0 },
      progressionId: "canon",
    };
    const back = parseKeysDraft(serializeKeysDraft(d))!;
    expect(back).toEqual(d);
  });

  it("잘못된 조/진행 id 는 기본값으로, fifths 는 다시 계산", () => {
    const r = parseKeysDraft(
      JSON.stringify({ notes: [], key: { tonic: 2, mode: "major", fifths: 99 }, progressionId: "nope" }),
    )!;
    expect(r.key.fifths).toBe(2);
    expect(r.progressionId).toBe("auto");
    expect(parseKeysDraft(JSON.stringify({ notes: [], key: { tonic: "x", mode: "major" } }))!.key.tonic).toBe(0);
  });
});
