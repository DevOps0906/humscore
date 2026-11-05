import { describe, expect, it } from "vitest";
import { parseKeysDraft, serializeKeysDraft, type KeysDraft } from "../keys-draft";

const note = { midi: 60, startBeat: 0, durationBeats: 1 };

describe("keys-draft", () => {
  it("반주 모드와 템플릿을 복원하며 잘못된 설정은 생략한다", () => {
    const draft: KeysDraft = { notes: [note], bpm: 90, meter: "4/4", key: { tonic: 0, mode: "major", fifths: 0 }, progressionId: "auto", accompaniment: { mode: "arpeggio", pattern: "alberti" } };
    expect(parseKeysDraft(serializeKeysDraft(draft))?.accompaniment).toEqual(draft.accompaniment);
    expect(parseKeysDraft(JSON.stringify({ ...draft, accompaniment: { mode: "arpeggio", pattern: "unknown" } }))?.accompaniment).toBeUndefined();
    expect(parseKeysDraft(JSON.stringify({ ...draft, accompaniment: { mode: "unknown", pattern: "alberti" } }))?.accompaniment).toBeUndefined();
  });
  it("5현 베이스와 오케스트라 악기 설정을 수동 코드 유무에 관계없이 왕복 복원한다", () => {
    const variants = [
      { notation: "guitarTab", instrument: "bassGuitar5" },
      { notation: "orchestra", instrument: "triangle" },
      { notation: "drums", instrument: "drumKit" },
      { notation: "piano", instrument: "epRhodes" },
    ] as const;
    for (const settings of variants) {
      for (const chords of [undefined, [{ startBeat: 0, symbol: "C" }]]) {
        const draft: KeysDraft = {
          notes: [note], bpm: 90, meter: "4/4", key: { tonic: 0, mode: "major", fifths: 0 },
          progressionId: "auto", ...settings, ...(chords ? { chords } : {}),
        };
        expect(parseKeysDraft(serializeKeysDraft(draft))).toEqual(draft);
      }
    }
  });

  it("구버전·손상된 악기 설정은 생략하여 기존 기본값 복원을 유지한다", () => {
    for (const settings of [{}, { notation: "unknown", instrument: "unknown" }, { notation: 1, instrument: null }, { notation: "toString", instrument: "toString" }]) {
      const draft = parseKeysDraft(JSON.stringify({ notes: [note], ...settings }));
      expect(draft).not.toBeNull();
      expect(draft?.notation).toBeUndefined();
      expect(draft?.instrument).toBeUndefined();
    }
    expect(parseKeysDraft(JSON.stringify({ notes: [note], notation: "orchestra", instrument: "unknown" }))?.notation).toBe("orchestra");
    expect(parseKeysDraft(JSON.stringify({ notes: [note], notation: "unknown", instrument: "bassGuitar5" }))?.instrument).toBe("bassGuitar5");
  });

  it("작곡한 악보 식별자를 복원하고 잘못된 식별자는 저장 대상으로 쓰지 않는다", () => {
    const scoreId = "a5400aa8-7afd-4d28-a0f2-9ce2d5f069fb";
    const draft: KeysDraft = { notes: [note], bpm: 90, meter: "4/4", key: { tonic: 0, mode: "major", fifths: 0 }, progressionId: "auto", scoreId };
    expect(parseKeysDraft(serializeKeysDraft(draft))?.scoreId).toBe(scoreId);
    expect(parseKeysDraft(JSON.stringify({ ...draft, scoreId: "손상된 식별자" }))?.scoreId).toBeUndefined();
    expect(parseKeysDraft(JSON.stringify({ notes: [note] }))?.scoreId).toBeUndefined();
  });
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

  it("수동 코드는 위치와 기호를 보존하며 구버전에는 수동 코드를 만들지 않는다", () => {
    const d: KeysDraft = {
      notes: [note], bpm: 90, meter: "4/4", key: { tonic: 0, mode: "major", fifths: 0 },
      progressionId: "auto", chords: [{ startBeat: 0, symbol: "F" }, { startBeat: 4, symbol: "G7" }],
    };
    expect(parseKeysDraft(serializeKeysDraft(d))).toEqual(d);
    expect(parseKeysDraft(JSON.stringify({ notes: [note] }))?.chords).toBeUndefined();
    expect(parseKeysDraft(JSON.stringify({ ...d, chords: [] }))?.chords).toEqual([]);
  });

  it("손상된 수동 코드는 자동 추천으로 조용히 바꾸지 않고 초안 전체를 거부한다", () => {
    for (const chords of [[{ startBeat: -1, symbol: "C" }], [{ startBeat: 0, symbol: "틀린 코드" }], "C", null]) {
      expect(parseKeysDraft(JSON.stringify({ notes: [note], chords }))).toBeNull();
    }
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
