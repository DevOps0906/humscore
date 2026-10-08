import { describe, expect, it } from "vitest";
import { fillRests, measureCount, quantizeNotes, totalBeats } from "../quantize";
import type { RawNote } from "../types";

const raw = (midi: number | null, s: number, e: number): RawNote => ({ midi, startSec: s, endSec: e, meanCents: 0 });
const o = { bpm: 120, beatsPerMeasure: 4, grid: 0.5 }; // 1박 = 0.5s

describe("quantizeNotes", () => {
  it("빈 입력 -> 한 마디 전체 쉼표", () => {
    expect(quantizeNotes([], o)).toEqual([{ midi: null, startBeat: 0, durationBeats: 4 }]);
  });
  it("격자에 스냅", () => {
    expect(quantizeNotes([raw(60, 0.02, 0.48)], o)[0]).toEqual({ midi: 60, startBeat: 0, durationBeats: 1 });
  });
  it("마디 끝 쉼표 채우기", () => {
    expect(quantizeNotes([raw(60, 0, 0.5)], o)).toEqual([
      { midi: 60, startBeat: 0, durationBeats: 1 },
      { midi: null, startBeat: 1, durationBeats: 3 },
    ]);
  });
  it("음이 정확히 마디를 채우면 쉼표 없음", () => {
    expect(quantizeNotes([raw(60, 0, 2)], o)).toEqual([{ midi: 60, startBeat: 0, durationBeats: 4 }]);
  });
  it("음 앞 공백은 앞 쉼표", () => {
    const r = quantizeNotes([raw(60, 1, 1.5)], o);
    expect(r[0]).toEqual({ midi: null, startBeat: 0, durationBeats: 2 });
    expect(r[1]).toMatchObject({ midi: 60, startBeat: 2, durationBeats: 1 });
  });
  it("아주 짧은 음은 최소 1격자", () => {
    expect(quantizeNotes([raw(60, 0.01, 0.05)], o)[0]).toMatchObject({ midi: 60, startBeat: 0, durationBeats: 0.5 });
  });
  it("겹치는 음은 앞 음 끝으로 밀림", () => {
    const r = quantizeNotes([raw(60, 0, 0.5), raw(62, 0.2, 1.0)], o).filter((n) => n.midi !== null);
    expect(r[1].startBeat).toBe(1);
    expect(r[1].durationBeats).toBe(1);
  });
  it("완전히 가려진 음은 버림", () => {
    const r = quantizeNotes([raw(60, 0, 1), raw(62, 0.2, 0.7)], o).filter((n) => n.midi !== null);
    expect(r).toHaveLength(1);
  });
  it("입력이 정렬 안 돼 있어도 정렬", () => {
    const r = quantizeNotes([raw(62, 0.5, 1), raw(60, 0, 0.5)], o).filter((n) => n.midi !== null);
    expect(r.map((n) => n.midi)).toEqual([60, 62]);
  });
  it("midi null 입력은 무시", () => {
    const r = quantizeNotes([raw(null, 0, 1), raw(60, 1, 1.5)], o);
    expect(r[0]).toEqual({ midi: null, startBeat: 0, durationBeats: 2 });
  });
  it("offsetBeats 적용", () => {
    const r = quantizeNotes([raw(60, 0, 0.5)], { ...o, offsetBeats: 1 });
    expect(r[0]).toEqual({ midi: null, startBeat: 0, durationBeats: 1 });
    expect(r[1]).toMatchObject({ midi: 60, startBeat: 1 });
  });
  it("3/4 박자 마디 채움", () => {
    expect(totalBeats(quantizeNotes([raw(60, 0, 0.5)], { ...o, beatsPerMeasure: 3 }))).toBe(3);
  });
  it("마디 넘는 음 뒤는 다음 마디 끝까지 채움", () => {
    const r = quantizeNotes([raw(60, 1.5, 3)], o); // beat 3 ~ 6
    expect(totalBeats(r)).toBe(8);
    expect(measureCount(r, 4)).toBe(2);
  });
  it("총합이 항상 마디 배수", () => {
    for (const end of [0.3, 0.9, 1.7, 2.4, 3.1]) {
      expect(totalBeats(quantizeNotes([raw(60, 0, end)], o)) % 4).toBe(0);
    }
  });
});

describe("fillRests / totalBeats / measureCount", () => {
  it("빈 배열 -> 한 마디 쉼표", () => {
    expect(fillRests([], 4)).toEqual([{ midi: null, startBeat: 0, durationBeats: 4 }]);
  });
  it("기존 쉼표는 버리고 다시 계산", () => {
    const input = [{ midi: null, startBeat: 0, durationBeats: 2 }, { midi: 60, startBeat: 2, durationBeats: 2 }];
    expect(fillRests(input, 4)).toEqual(input);
  });
  it("totalBeats 빈 배열 0, measureCount 최소 1", () => {
    expect(totalBeats([])).toBe(0);
    expect(measureCount([], 4)).toBe(1);
  });
  it("measureCount 경계: 8박 = 2마디, 8.5박 = 3마디", () => {
    expect(measureCount([{ midi: 60, startBeat: 0, durationBeats: 8 }], 4)).toBe(2);
    expect(measureCount([{ midi: 60, startBeat: 0, durationBeats: 8.5 }], 4)).toBe(3);
  });
});
