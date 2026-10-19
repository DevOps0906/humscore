import { describe, expect, it } from "vitest";
import { splitForNotation } from "../notation";
import type { NoteEvent } from "../types";

const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });
/** 간결한 비교용: [start, dur, type(+".") , tie("<" 받음, ">" 이음)] */
const sum = (events: NoteEvent[], bpm = 4, measures?: number) =>
  splitForNotation(events, { beatsPerMeasure: bpm, measures }).map((p) => [
    p.startBeat,
    p.durationBeats,
    p.type + (p.dots ? "." : ""),
    (p.tieStop ? "<" : "") + (p.tieStart ? ">" : ""),
  ]);

describe("splitForNotation: 음표", () => {
  it("마디선을 넘는 음은 나눠 붙임줄", () => {
    const r = sum([n(60, 0, 3), n(62, 3, 3), n(null, 6, 2)]);
    expect(r).toContainEqual([3, 1, "quarter", ">"]);
    expect(r).toContainEqual([4, 2, "half", "<"]);
  });
  it("표기 불가 길이(5박)는 합으로 분해", () => {
    expect(sum([n(60, 0, 5), n(null, 5, 3)]).slice(0, 2)).toEqual([
      [0, 4, "whole", ">"],
      [4, 1, "quarter", "<"],
    ]);
  });
  it("4/4 온음표는 마디 전체일 때만, 박 2의 3박은 가운데에서 나눔", () => {
    expect(sum([n(60, 0, 4)])).toEqual([[0, 4, "whole", ""]]);
    expect(sum([n(null, 0, 1), n(60, 1, 3)])).toEqual([
      [0, 1, "quarter", ""],
      [1, 1, "quarter", ">"],
      [2, 2, "half", "<"],
    ]);
  });
  it("4/4 2분음표: 박 1·3 가능, 박 2는 나눔, 4분-2분-4분 당김음은 유지", () => {
    expect(sum([n(60, 0, 2), n(62, 2, 2)])).toEqual([
      [0, 2, "half", ""],
      [2, 2, "half", ""],
    ]);
    expect(sum([n(60, 0, 1), n(62, 1, 2), n(64, 3, 1)]).map((x) => x[2])).toEqual(["quarter", "half", "quarter"]);
    expect(sum([n(60, 0, 1), n(62, 1, 2), n(null, 3, 1)]).map((x) => x[2])).toEqual(["quarter", "half", "quarter"]);
    // 앞이 8분 둘이면 당김음 패턴이 아님 -> 나눔
    const r = sum([n(60, 0, 0.5), n(61, 0.5, 0.5), n(62, 1, 2), n(64, 3, 1)]);
    expect(r).toContainEqual([1, 1, "quarter", ">"]);
    expect(r).toContainEqual([2, 1, "quarter", "<"]);
  });
  it("점2분은 박 1만 (4/4)", () => {
    expect(sum([n(60, 0, 3), n(null, 3, 1)])[0]).toEqual([0, 3, "half.", ""]);
  });
  it("박 중간 시작이 박을 넘으면 박에서 나눔 (8분 + 이음 8분)", () => {
    const r = sum([n(null, 0, 0.5), n(60, 0.5, 1), n(null, 1.5, 1.5)], 3);
    expect(r.slice(0, 3)).toEqual([
      [0, 0.5, "eighth", ""],
      [0.5, 0.5, "eighth", ">"],
      [1, 0.5, "eighth", "<"],
    ]);
  });
  it("8분-4분-8분 당김음은 4분음표 하나로 (박 0.5, 2.5)", () => {
    expect(sum([n(60, 0, 0.5), n(62, 0.5, 1), n(64, 1.5, 0.5), n(null, 2, 2)]).slice(0, 3).map((x) => x[2])).toEqual(["eighth", "quarter", "eighth"]);
    expect(sum([n(null, 0, 2), n(60, 2, 0.5), n(62, 2.5, 1), n(64, 3.5, 0.5)]).slice(1).map((x) => x[2])).toEqual(["eighth", "quarter", "eighth"]);
  });
  it("박 1.5 시작 4분음표는 마디 가운데를 넘으므로 나눔", () => {
    const r = sum([n(null, 0, 1.5), n(60, 1.5, 1), n(null, 2.5, 1.5)]);
    expect(r).toContainEqual([1.5, 0.5, "eighth", ">"]);
    expect(r).toContainEqual([2, 0.5, "eighth", "<"]);
  });
  it("점4분: 박 1·3 허용, 박 2는 가운데를 넘으므로 나눔; 점8분은 박 위에서", () => {
    expect(sum([n(60, 0, 1.5), n(62, 1.5, 0.5), n(null, 2, 2)])[0]).toEqual([0, 1.5, "quarter.", ""]);
    expect(sum([n(null, 0, 2), n(60, 2, 1.5), n(62, 3.5, 0.5)])[1]).toEqual([2, 1.5, "quarter.", ""]);
    const r = sum([n(null, 0, 1), n(60, 1, 1.5), n(62, 2.5, 1.5)]);
    expect(r).toContainEqual([1, 1, "quarter", ">"]);
    expect(sum([n(60, 0, 0.75), n(62, 0.75, 0.25), n(null, 1, 3)]).slice(0, 2)).toEqual([
      [0, 0.75, "eighth.", ""],
      [0.75, 0.25, "16th", ""],
    ]);
  });
  it("3/4: 점2분이 마디를 채움, 2/4: 2분이 마디를 채움", () => {
    expect(sum([n(60, 0, 3)], 3)).toEqual([[0, 3, "half.", ""]]);
    expect(sum([n(60, 0, 2)], 2)).toEqual([[0, 2, "half", ""]]);
    expect(sum([n(60, 0, 1), n(62, 1, 2)], 3)).toEqual([
      [0, 1, "quarter", ""],
      [1, 2, "half", ""],
    ]);
  });
  it("조각 길이 합 = 마디 길이, 소스 인덱스 유지", () => {
    const ev = [n(60, 0, 2.75), n(62, 2.75, 3.25), n(null, 6, 2)];
    const ps = splitForNotation(ev, { beatsPerMeasure: 4 });
    for (const m of [0, 1]) expect(ps.filter((p) => p.measure === m).reduce((s, p) => s + p.durationBeats, 0)).toBe(4);
    expect(ps.filter((p) => p.source === 1).every((p) => p.midi === 62)).toBe(true);
  });
});

describe("splitForNotation: 쉼표", () => {
  it("마디 전체 쉼표는 어떤 박자든 온쉼표 한 개 (measureRest)", () => {
    for (const bpm of [2, 3, 4, 6]) {
      const ps = splitForNotation([n(null, 0, bpm)], { beatsPerMeasure: bpm });
      expect(ps).toHaveLength(1);
      expect(ps[0]).toMatchObject({ measureRest: true, type: "whole", durationBeats: bpm });
    }
  });
  it("박 0.5~3 쉼표: 8분, 4분, 4분", () => {
    expect(sum([n(60, 0, 0.5), n(null, 0.5, 2.5), n(62, 3, 1)]).slice(1, 4)).toEqual([
      [0.5, 0.5, "eighth", ""],
      [1, 1, "quarter", ""],
      [2, 1, "quarter", ""],
    ]);
  });
  it("2분쉼표는 박 1·3에서만, 점쉼표 없음", () => {
    expect(sum([n(60, 0, 1), n(null, 1, 3)]).slice(1)).toEqual([
      [1, 1, "quarter", ""],
      [2, 2, "half", ""],
    ]);
    expect(sum([n(60, 0, 3), n(null, 3, 1)]).slice(1)).toEqual([[3, 1, "quarter", ""]]);
    expect(sum([n(null, 0, 3), n(60, 3, 1)]).slice(0, 2)).toEqual([
      [0, 2, "half", ""],
      [2, 1, "quarter", ""],
    ]);
    expect(sum([n(60, 0, 1), n(null, 1, 2), n(62, 3, 1)]).slice(1, 3)).toEqual([
      [1, 1, "quarter", ""],
      [2, 1, "quarter", ""],
    ]);
  });
  it("박 안의 쉼표는 작은 음가부터, 16분 단위", () => {
    const r = sum([n(60, 0, 0.25), n(null, 0.25, 0.75), n(62, 1, 3)]);
    expect(r[1]).toEqual([0.25, 0.25, "16th", ""]);
    expect(r[2]).toEqual([0.5, 0.5, "eighth", ""]);
  });
  it("쉼표는 마디를 넘어도 붙임줄 없음; 마지막 마디 부족분은 쉼표로 채움", () => {
    const ps = splitForNotation([n(60, 0, 1), n(null, 1, 7)], { beatsPerMeasure: 4 });
    expect(ps.some((p) => p.tieStart || p.tieStop)).toBe(false);
    expect(ps.filter((p) => p.measure === 1)).toHaveLength(1); // 둘째 마디는 온쉼표
    const ps2 = splitForNotation([n(60, 0, 4), n(62, 4, 1)], { beatsPerMeasure: 4 });
    expect(ps2.filter((p) => p.measure === 1 && p.midi === null).map((p) => p.type)).toEqual(["quarter", "half"]);
  });
  it("measures 옵션으로 뒤를 온쉼표 마디로 채움", () => {
    expect(splitForNotation([n(60, 0, 4)], { beatsPerMeasure: 4, measures: 3 }).filter((p) => p.measureRest)).toHaveLength(2);
  });
});
