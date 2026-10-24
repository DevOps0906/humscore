import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { GM_INSTRUMENTS, latin1AsUtf8, scoreToMidi } from "../midi";
import { makeScore } from "./helpers";
import type { NoteEvent } from "../types";

const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });
const melody = [n(60, 0, 1), n(null, 1, 1), n(64, 2, 2), n(67, 4, 4)];
const chords = [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G7" }];

describe("scoreToMidi", () => {
  it("멜로디 트랙: 쉼표 제외 음 수, 시작/길이 (초)", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { bpm: 120 }), { withChords: false }));
    expect(parsed.tracks).toHaveLength(1);
    const notes = parsed.tracks[0].notes;
    expect(notes.map((x) => x.midi)).toEqual([60, 64, 67]);
    expect(notes[1].time).toBeCloseTo(1.0, 2);
    expect(notes[1].duration).toBeCloseTo(1.0, 2);
    expect(parsed.header.tempos[0].bpm).toBeCloseTo(120, 3);
  });
  it("코드 있으면 2트랙, 코드 구성음 수 (C=3, G7=4)", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { chords })));
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks[1].notes).toHaveLength(7);
    expect(parsed.tracks[1].notes.slice(0, 3).map((x) => x.midi)).toEqual([48, 52, 55]);
  });
  it("chords 배열이 비면 코드 트랙 없음", () => {
    expect(new Midi(scoreToMidi(makeScore(melody))).tracks).toHaveLength(1);
  });
  it("withChords:false 면 코드 있어도 1트랙", () => {
    expect(new Midi(scoreToMidi(makeScore(melody, { chords }), { withChords: false })).tracks).toHaveLength(1);
  });
  it("빈 notes 도 예외 없이 빈 트랙", () => {
    const parsed = new Midi(scoreToMidi(makeScore([])));
    expect(parsed.tracks[0].notes).toHaveLength(0);
  });
  it("쉼표만 있는 악보", () => {
    const parsed = new Midi(scoreToMidi(makeScore([n(null, 0, 4)])));
    expect(parsed.tracks[0].notes).toHaveLength(0);
  });
  it("transpose 반영: 멜로디 +n, 코드도 이동", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { chords, transpose: 5 })));
    expect(parsed.tracks[0].notes.map((x) => x.midi)).toEqual([65, 69, 72]);
    // C -> F : 근음 pc 5 (옥타브 3 = 53)
    expect(parsed.tracks[1].notes[0].midi).toBe(53);
  });
  it("transpose 음수", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { transpose: -12 }), { withChords: false }));
    expect(parsed.tracks[0].notes.map((x) => x.midi)).toEqual([48, 52, 55]);
  });
  it("원본 Score 불변", () => {
    const s = makeScore(melody, { chords, transpose: 3 });
    const before = JSON.parse(JSON.stringify(s));
    scoreToMidi(s);
    expect(s).toEqual(before);
  });
  it("악기 지정: 멜로디/코드", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { chords }), { melodyInstrument: "violin", chordInstrument: "strings" }));
    expect(parsed.tracks[0].instrument.number).toBe(GM_INSTRUMENTS.violin);
    expect(parsed.tracks[1].instrument.number).toBe(GM_INSTRUMENTS.strings);
  });
  it("기본 악기는 피아노(0)", () => {
    expect(new Midi(scoreToMidi(makeScore(melody))).tracks[0].instrument.number).toBe(0);
  });
  it("박자표/제목 헤더 (ASCII 제목)", () => {
    const parsed = new Midi(scoreToMidi(makeScore(melody, { beatsPerMeasure: 3, title: "Waltz" })));
    expect(parsed.header.timeSignatures[0].timeSignature).toEqual([3, 4]);
    expect(parsed.header.name).toBe("Waltz");
  });
  // midi-file 파서는 메타 텍스트를 1바이트 문자열로 돌려주므로 UTF-8 로 다시 디코딩해 비교
  it("한글 제목이 MIDI 헤더 왕복 후 유지", () => {
    const bytes = scoreToMidi(makeScore(melody, { title: "왈츠" }));
    const parsed = new Midi(bytes);
    expect(latin1AsUtf8(parsed.header.name)).toBe("왈츠");
    // 파일에 UTF-8 바이트(왈 = EC 99 88)가 그대로 기록됨
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex).toContain("ec9988" + "ecb8a0");
  });
  it("템포가 시간 환산에 반영 (60bpm: 1박 = 1초)", () => {
    const parsed = new Midi(scoreToMidi(makeScore([n(60, 2, 1)], { bpm: 60 }), { withChords: false }));
    expect(parsed.tracks[0].notes[0].time).toBeCloseTo(2, 2);
  });
});

describe("scoreToMidi 박자표", () => {
  it("6/8 은 [6,8], 3/4 는 [3,4], 4/4 는 [4,4]", () => {
    const ts = (over = {}) => new Midi(scoreToMidi(makeScore(melody, over))).header.timeSignatures[0].timeSignature;
    expect(ts({ beatsPerMeasure: 3, meter: "6/8" })).toEqual([6, 8]);
    expect(ts({ beatsPerMeasure: 3 })).toEqual([3, 4]);
    expect(ts()).toEqual([4, 4]);
  });
});

describe("scoreToMidi 반복·셈여림", () => {
  const two = [n(60, 0, 4), n(62, 4, 4)];
  it("도돌이표를 펼쳐 음 수와 시작 시각이 늘어남", () => {
    const parsed = new Midi(scoreToMidi(makeScore(two, { bpm: 120, marks: [{ measure: 1, kind: "repeatEnd" }] }), { withChords: false }));
    const notes = parsed.tracks[0].notes;
    expect(notes.map((x) => x.midi)).toEqual([60, 62, 60, 62]);
    expect(notes[2].time).toBeCloseTo(4, 2); // 8박 = 4초
    expect(parsed.duration).toBeCloseTo(8, 1);
  });
  it("D.C. al Fine 도 펼침", () => {
    const sc = makeScore([n(60, 0, 4), n(62, 4, 4), n(64, 8, 4)], { marks: [{ measure: 0, kind: "fine" }, { measure: 2, kind: "dcAlFine" }] });
    const notes = new Midi(scoreToMidi(sc, { withChords: false })).tracks[0].notes;
    expect(notes.map((x) => x.midi)).toEqual([60, 62, 64, 60]);
  });
  it("셈여림 없으면 기본 mf velocity, 있으면 반영", () => {
    const plain = new Midi(scoreToMidi(makeScore(two), { withChords: false })).tracks[0].notes;
    expect(plain[0].velocity).toBeCloseTo(0.65, 1);
    const dyn = new Midi(scoreToMidi(makeScore(two, { dynamics: [{ startBeat: 0, kind: "pp" }, { startBeat: 4, kind: "ff" }] }), { withChords: false })).tracks[0].notes;
    expect(dyn[0].velocity).toBeCloseTo(0.3, 1);
    expect(dyn[1].velocity).toBeCloseTo(0.95, 1);
  });
  it("원본 Score 는 바뀌지 않음", () => {
    const sc = makeScore(two, { marks: [{ measure: 1, kind: "repeatEnd" }] });
    const snap = JSON.stringify(sc);
    scoreToMidi(sc);
    expect(JSON.stringify(sc)).toBe(snap);
  });
});
