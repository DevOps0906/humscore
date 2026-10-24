import { describe, expect, it } from "vitest";
import {
  CHORD_QUALITIES, STEP_DURATIONS, appendNote, chordAtMeasure, createBlankScore, deleteNote, insertNote,
  isValidChordSymbol, measureOf, reflow, removeDynamic, scoreMeasureCount, setChordAtMeasure, setDynamic, toggleMeasureMark, updateNote,
} from "../edit";
import type { NoteEvent } from "../types";
import { makeScore } from "./helpers";

const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });

describe("edit", () => {
  it("STEP_DURATIONS", () => expect(STEP_DURATIONS).toEqual([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]));
  it("reflow: 정렬 후 빈틈없이", () => {
    expect(reflow([n(62, 5, 1), n(60, 0, 2)])).toEqual([n(60, 0, 2), n(62, 2, 1)]);
  });
  it("appendNote / 쉼표", () => {
    const a = [n(60, 0, 1)];
    const r = appendNote(a, null, 2);
    expect(r).toEqual([n(60, 0, 1), n(null, 1, 2)]);
    expect(a).toHaveLength(1);
  });
  it("insertNote: 중간 / 끝", () => {
    const a = [n(60, 0, 1), n(64, 1, 1)];
    expect(insertNote(a, 1, 62, 2)).toEqual([n(60, 0, 1), n(62, 1, 2), n(64, 3, 1)]);
    expect(insertNote(a, 9, 67, 1)).toEqual([n(60, 0, 1), n(64, 1, 1), n(67, 2, 1)]);
    expect(a).toEqual([n(60, 0, 1), n(64, 1, 1)]);
  });
  it("updateNote: clamp, 0.25 반올림, 뒤 음 이동", () => {
    const a = [n(60, 0, 1), n(64, 1, 1)];
    expect(updateNote(a, 0, { midi: 200 })[0].midi).toBe(108);
    expect(updateNote(a, 0, { midi: 3 })[0].midi).toBe(21);
    const r = updateNote(a, 0, { durationBeats: 1.6 });
    expect(r[0].durationBeats).toBe(1.5);
    expect(r[1].startBeat).toBe(1.5);
    expect(updateNote(a, 0, { durationBeats: 0 })[0].durationBeats).toBe(0.25);
    expect(updateNote(a, 1, { midi: null })[1].midi).toBeNull();
    expect(a[0].midi).toBe(60);
  });
  it("deleteNote", () => {
    const a = [n(60, 0, 1), n(62, 1, 1), n(64, 2, 1)];
    expect(deleteNote(a, 1)).toEqual([n(60, 0, 1), n(64, 1, 1)]);
    const same = deleteNote(a, 5);
    expect(same).toEqual(a);
    expect(same).not.toBe(a);
  });
  it("measureOf / scoreMeasureCount", () => {
    expect(measureOf(0, 4)).toBe(0);
    expect(measureOf(3.99, 4)).toBe(0);
    expect(measureOf(4, 4)).toBe(1);
    expect(scoreMeasureCount({ notes: [], chords: [], beatsPerMeasure: 4 })).toBe(1);
    expect(scoreMeasureCount({ notes: [n(60, 0, 4)], chords: [], beatsPerMeasure: 4 })).toBe(1);
    expect(scoreMeasureCount({ notes: [n(60, 0, 4.5)], chords: [], beatsPerMeasure: 4 })).toBe(2);
    expect(scoreMeasureCount({ notes: [n(60, 0, 4)], chords: [{ startBeat: 8, symbol: "C" }], beatsPerMeasure: 4 })).toBe(3);
  });
  it("코드 설정/교체/삭제/정렬", () => {
    let c = setChordAtMeasure([], 2, 4, "G");
    c = setChordAtMeasure(c, 0, 4, "C");
    expect(c).toEqual([{ startBeat: 0, symbol: "C" }, { startBeat: 8, symbol: "G" }]);
    c = setChordAtMeasure(c, 2, 4, "Am");
    expect(chordAtMeasure(c, 2, 4)?.symbol).toBe("Am");
    expect(chordAtMeasure(c, 1, 4)).toBeUndefined();
    expect(setChordAtMeasure(c, 0, 4, null)).toEqual([{ startBeat: 8, symbol: "Am" }]);
  });
  it("코드 유효성 / 품질", () => {
    for (const s of ["C", "F#m7", "Bb/D", "Gsus4", "Cmaj7", "Bdim"]) expect(isValidChordSymbol(s)).toBe(true);
    for (const s of ["", "H", "Cx", "c", "C/"]) expect(isValidChordSymbol(s)).toBe(false);
    for (const q of CHORD_QUALITIES) expect(isValidChordSymbol("C" + q.suffix)).toBe(true);
  });
  it("createBlankScore 기본값", () => {
    const s = createBlankScore();
    expect(s).toMatchObject({ bpm: 90, beatsPerMeasure: 4, transpose: 0, notes: [], chords: [], beatUnit: 4 });
    expect(s.key).toEqual({ tonic: 0, mode: "major", fifths: 0 });
    expect(s.id).toBeTruthy();
    expect(createBlankScore({ title: "x", bpm: 100 })).toMatchObject({ title: "x", bpm: 100 });
  });
});

describe("셈여림·마디 기호 편집", () => {
  const base = makeScore([n(60, 0, 8)]);
  it("setDynamic: 정렬, 같은 박은 교체, 원본 불변", () => {
    const a = setDynamic(base, 4, "f");
    const b = setDynamic(a, 0, "p");
    const c = setDynamic(b, 4, "cresc", 2);
    expect(base.dynamics).toBeUndefined();
    expect(b.dynamics).toEqual([{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "f" }]);
    expect(c.dynamics).toEqual([{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "cresc", durationBeats: 2 }]);
    expect(b.dynamics).toHaveLength(2);
  });
  it("setDynamic: 헤어핀 길이 기본은 한 마디, 단계 기호엔 길이 없음", () => {
    expect(setDynamic(base, 0, "dim").dynamics![0].durationBeats).toBe(4);
    expect(setDynamic(base, 0, "mp", 3).dynamics![0]).toEqual({ startBeat: 0, kind: "mp" });
  });
  it("removeDynamic: 삭제, 비면 dynamics 제거", () => {
    const a = setDynamic(setDynamic(base, 0, "p"), 4, "f");
    expect(removeDynamic(a, 0).dynamics).toEqual([{ startBeat: 4, kind: "f" }]);
    expect(removeDynamic(removeDynamic(a, 0), 4).dynamics).toBeUndefined();
    expect(a.dynamics).toHaveLength(2);
  });
  it("toggleMeasureMark: 추가/제거 토글, 마디순 정렬, 원본 불변", () => {
    const a = toggleMeasureMark(base, 3, "repeatEnd");
    const b = toggleMeasureMark(a, 1, "repeatStart");
    expect(b.marks).toEqual([{ measure: 1, kind: "repeatStart" }, { measure: 3, kind: "repeatEnd" }]);
    expect(toggleMeasureMark(b, 3, "repeatEnd").marks).toEqual([{ measure: 1, kind: "repeatStart" }]);
    expect(toggleMeasureMark(toggleMeasureMark(base, 0, "segno"), 0, "segno").marks).toBeUndefined();
    expect(base.marks).toBeUndefined();
    expect(a.marks).toHaveLength(1);
  });
  it("toggleMeasureMark: 시작 위치 그룹은 한 마디에 하나", () => {
    const a = toggleMeasureMark(toggleMeasureMark(base, 2, "repeatStart"), 2, "segno");
    expect(a.marks).toEqual([{ measure: 2, kind: "segno" }]);
  });
  it("toggleMeasureMark: dc/ds/fine/toCoda 계열은 하나만, repeatEnd 는 공존", () => {
    let s = toggleMeasureMark(base, 1, "repeatEnd");
    s = toggleMeasureMark(s, 1, "fine");
    s = toggleMeasureMark(s, 1, "dsAlCoda");
    expect(s.marks).toEqual([{ measure: 1, kind: "repeatEnd" }, { measure: 1, kind: "dsAlCoda" }]);
    s = toggleMeasureMark(s, 1, "dc");
    expect(s.marks!.map((m) => m.kind)).toEqual(["repeatEnd", "dc"]);
  });
});
