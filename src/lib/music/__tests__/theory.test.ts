import { describe, expect, it } from "vitest";
import { chordToMidi, estimateKey, fifthsFor, keyName, suggestChords, transposeChordSymbol, transposeKey } from "../theory";
import type { KeyInfo, NoteEvent } from "../types";

const seq = (midis: number[], dur = 1, offset = 0): NoteEvent[] =>
  midis.map((m, i) => ({ midi: m, startBeat: offset + i * dur, durationBeats: dur }));

describe("estimateKey", () => {
  it("빈/쉼표만 -> C장조 기본값", () => {
    expect(estimateKey([])).toEqual({ tonic: 0, mode: "major", fifths: 0 });
    expect(estimateKey([{ midi: null, startBeat: 0, durationBeats: 4 }])).toEqual({ tonic: 0, mode: "major", fifths: 0 });
  });
  it("C장조 음계", () => {
    expect(estimateKey(seq([60, 62, 64, 65, 67, 69, 71, 72]))).toMatchObject({ tonic: 0, mode: "major" });
  });
  it("G장조 (F# 포함, G로 끝남)", () => {
    expect(estimateKey(seq([67, 69, 71, 72, 74, 71, 66, 67]))).toMatchObject({ tonic: 7, mode: "major", fifths: 1 });
  });
  it("A단조", () => {
    expect(estimateKey(seq([69, 71, 72, 74, 72, 71, 68, 69, 64, 69]))).toMatchObject({ tonic: 9, mode: "minor", fifths: 0 });
  });
  it("조성 추정은 전조에 대해 일관", () => {
    const base = seq([60, 62, 64, 65, 67, 65, 64, 62, 60]);
    for (const n of [1, 2, 5, 7, 11]) {
      expect(estimateKey(base.map((x) => ({ ...x, midi: x.midi! + n }))).tonic).toBe(n);
    }
  });
  it("입력 notes 변경 없음", () => {
    const n = seq([60, 62, 64]);
    const copy = JSON.parse(JSON.stringify(n));
    estimateKey(n);
    expect(n).toEqual(copy);
  });
});

describe("fifthsFor / keyName", () => {
  it("장조 12개 조표", () => {
    [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5].forEach((f, t) => expect(fifthsFor(t, "major")).toBe(f));
  });
  it("단조는 관계장조 기준", () => {
    expect(fifthsFor(9, "minor")).toBe(0);
    expect(fifthsFor(4, "minor")).toBe(1);
    expect(fifthsFor(0, "minor")).toBe(-3);
  });
  it("keyName", () => {
    expect(keyName({ tonic: 3, mode: "major", fifths: -3 })).toBe("Eb");
    expect(keyName({ tonic: 2, mode: "minor", fifths: -1 })).toBe("Dm");
    expect(keyName({ tonic: 6, mode: "major", fifths: 6 })).toBe("F#");
  });
});

describe("suggestChords", () => {
  const C: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };
  it("measures=0 -> 빈 배열", () => expect(suggestChords([], C, 4, 0)).toEqual([]));
  it("마디당 1코드, startBeat = 마디 시작", () => {
    const ch = suggestChords(seq([60, 64, 67, 64, 62, 65, 69, 65]), C, 4, 2);
    expect(ch.map((c) => c.startBeat)).toEqual([0, 4]);
  });
  it("C-E-G 마디 -> C", () => {
    expect(suggestChords(seq([60, 64, 67, 64]), C, 4, 1)[0].symbol).toBe("C");
  });
  it("G-B-D 중간 마디 -> G", () => {
    const notes = [...seq([60, 64, 67, 64]), ...seq([67, 71, 74, 71], 1, 4), ...seq([60, 60, 60, 60], 1, 8)];
    expect(suggestChords(notes, C, 4, 3)[1].symbol).toBe("G");
  });
  it("빈 마디는 앞 코드 유지", () => {
    const ch = suggestChords(seq([67, 71, 74, 71]), C, 4, 2);
    expect(ch[1].symbol).toBe(ch[0].symbol);
  });
  it("플랫 조는 플랫 표기 (F장조 IV = Bb)", () => {
    const F: KeyInfo = { tonic: 5, mode: "major", fifths: -1 };
    const notes = [...seq([65, 69, 72, 69]), ...seq([70, 74, 77, 74], 1, 4), ...seq([65, 69, 72, 69], 1, 8)];
    const ch = suggestChords(notes, F, 4, 3);
    expect(ch[0].symbol).toBe("F");
    expect(ch[1].symbol).toBe("Bb");
  });
  it("A단조 i = Am", () => {
    const Am: KeyInfo = { tonic: 9, mode: "minor", fifths: 0 };
    expect(suggestChords(seq([69, 72, 76, 72]), Am, 4, 1)[0].symbol).toBe("Am");
  });
});

describe("transposeKey", () => {
  const C: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };
  it("0, +12, -12, +24 는 동일", () => {
    for (const s of [0, 12, -12, 24]) expect(transposeKey(C, s)).toEqual(C);
  });
  it("+12 와 -12 결과 동일 (모든 단조)", () => {
    for (let t = 0; t < 12; t++) {
      const k: KeyInfo = { tonic: t, mode: "minor", fifths: fifthsFor(t, "minor") };
      expect(transposeKey(k, 12)).toEqual(k);
      expect(transposeKey(k, -12)).toEqual(k);
    }
  });
  it("-1 은 +11 과 동일, 모드 유지", () => {
    const k: KeyInfo = { tonic: 9, mode: "minor", fifths: 0 };
    expect(transposeKey(k, -1)).toEqual(transposeKey(k, 11));
    expect(transposeKey(k, -1).mode).toBe("minor");
  });
  it("원본 불변", () => {
    const k = { ...C };
    transposeKey(k, 5);
    expect(k).toEqual(C);
  });
});

describe("transposeChordSymbol", () => {
  it("±12 는 동일", () => {
    expect(transposeChordSymbol("Am7", 12, false)).toBe("Am7");
    expect(transposeChordSymbol("Am7", -12, false)).toBe("Am7");
    expect(transposeChordSymbol("C", 0, false)).toBe("C");
  });
  it("semitones 0 이면 철자 그대로 보존", () => {
    expect(transposeChordSymbol("Bb", 0, false)).toBe("Bb");
    expect(transposeChordSymbol("A#", 0, true)).toBe("A#");
    expect(transposeChordSymbol("F#m7/Bb", 0, true)).toBe("F#m7/Bb");
  });
  it("음수 이동 래핑", () => {
    expect(transposeChordSymbol("C", -1, false)).toBe("B");
    expect(transposeChordSymbol("C", -13, false)).toBe("B");
  });
  it("플랫 입력 처리", () => {
    expect(transposeChordSymbol("Bb", 2, false)).toBe("C");
  });
  it("분수 코드 베이스도 이동", () => {
    expect(transposeChordSymbol("C/E", 2, false)).toBe("D/F#");
    expect(transposeChordSymbol("C/E", 2, true)).toBe("D/Gb");
  });
  it("인식 불가 기호는 그대로", () => {
    expect(transposeChordSymbol("N.C.", 3, false)).toBe("N.C.");
  });
  it("품질 접미사 보존", () => {
    expect(transposeChordSymbol("Gmaj7", 2, false)).toBe("Amaj7");
    expect(transposeChordSymbol("Bdim", 1, false)).toBe("Cdim");
  });
});

describe("chordToMidi", () => {
  it("C 장3화음 옥타브 3", () => expect(chordToMidi("C")).toEqual([48, 52, 55]));
  it("Am", () => expect(chordToMidi("Am")).toEqual([57, 60, 64]));
  it("G7", () => expect(chordToMidi("G7")).toEqual([55, 59, 62, 65]));
  it("Cmaj7 은 장7도(+11)", () => expect(chordToMidi("Cmaj7")).toEqual([48, 52, 55, 59]));
  it("Bdim", () => expect(chordToMidi("Bdim")).toEqual([59, 62, 65]));
  it("F#m / Bb", () => {
    expect(chordToMidi("F#m")).toEqual([54, 57, 61]);
    expect(chordToMidi("Bb")).toEqual([58, 62, 65]);
  });
  it("옥타브 인자", () => expect(chordToMidi("C", 4)).toEqual([60, 64, 67]));
  it("분수 코드는 메인 코드 기준", () => expect(chordToMidi("C/E")).toEqual([48, 52, 55]));
  it("인식 불가 -> 빈 배열", () => expect(chordToMidi("N.C.")).toEqual([]));
});
