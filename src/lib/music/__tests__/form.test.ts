import { describe, expect, it } from "vitest";
import { measureOrder, unrollScore } from "../form";
import type { MeasureMark, NoteEvent } from "../types";
import { makeScore } from "./helpers";

/** 4/4 에서 마디마다 4분음표 4개 대신 온음표 1개(음높이 = 60 + 마디 번호) */
const whole = (count: number): NoteEvent[] => Array.from({ length: count }, (_, i) => ({ midi: 60 + i, startBeat: i * 4, durationBeats: 4 }));
const sc = (count: number, marks?: MeasureMark[]) => makeScore(whole(count), { marks });
const mk = (measure: number, kind: MeasureMark["kind"]): MeasureMark => ({ measure, kind });

describe("measureOrder", () => {
  it("marks 없음 / 빈 배열: 처음부터 끝까지", () => {
    expect(measureOrder(sc(4))).toEqual([0, 1, 2, 3]);
    expect(measureOrder(sc(4, []))).toEqual([0, 1, 2, 3]);
  });
  it("repeatEnd: 곡 처음으로 1회", () => {
    expect(measureOrder(sc(4, [mk(1, "repeatEnd")]))).toEqual([0, 1, 0, 1, 2, 3]);
  });
  it("repeatStart~repeatEnd 구간만 반복", () => {
    expect(measureOrder(sc(5, [mk(1, "repeatStart"), mk(2, "repeatEnd")]))).toEqual([0, 1, 2, 1, 2, 3, 4]);
  });
  it("도돌이표 두 쌍은 각각 가장 가까운 앞쪽 repeatStart", () => {
    const order = measureOrder(sc(6, [mk(0, "repeatStart"), mk(1, "repeatEnd"), mk(3, "repeatStart"), mk(4, "repeatEnd")]));
    expect(order).toEqual([0, 1, 0, 1, 2, 3, 4, 3, 4, 5]);
  });
  it("D.C. al Fine", () => {
    expect(measureOrder(sc(4, [mk(1, "fine"), mk(3, "dcAlFine")]))).toEqual([0, 1, 2, 3, 0, 1]);
  });
  it("D.C.: 처음으로 갔다가 끝까지", () => {
    expect(measureOrder(sc(3, [mk(1, "dc")]))).toEqual([0, 1, 0, 1, 2]);
  });
  it("D.S. al Coda", () => {
    const order = measureOrder(sc(6, [mk(1, "segno"), mk(2, "toCoda"), mk(3, "dsAlCoda"), mk(5, "coda")]));
    expect(order).toEqual([0, 1, 2, 3, 1, 2, 5]);
  });
  it("D.S. al Fine", () => {
    expect(measureOrder(sc(5, [mk(1, "segno"), mk(2, "fine"), mk(4, "dsAlFine")]))).toEqual([0, 1, 2, 3, 4, 1, 2]);
  });
  it("점프 후에는 도돌이표를 다시 반복하지 않음", () => {
    const order = measureOrder(sc(4, [mk(1, "repeatEnd"), mk(3, "dc")]));
    expect(order).toEqual([0, 1, 0, 1, 2, 3, 0, 1, 2, 3]);
  });
  it("segno 없는 D.S. 는 무시하고 끝까지", () => {
    expect(measureOrder(sc(3, [mk(2, "ds")]))).toEqual([0, 1, 2]);
    expect(measureOrder(sc(3, [mk(2, "dsAlCoda")]))).toEqual([0, 1, 2]);
  });
  it("coda 없는 D.C. al Coda 는 무한 루프 없이 끝", () => {
    expect(measureOrder(sc(3, [mk(1, "toCoda"), mk(2, "dcAlCoda")]))).toEqual([0, 1, 2, 0, 1, 2]);
  });
  it("순환·중복·범위 밖 기호도 유한하게 끝남", () => {
    const marks = [mk(0, "dc"), mk(1, "dc"), mk(2, "ds"), mk(1, "segno"), mk(2, "repeatEnd"), mk(0, "repeatEnd"), mk(99, "dc"), mk(-3, "ds")];
    const order = measureOrder(sc(3, marks));
    expect(order.length).toBeLessThan(100);
    expect(order.every((m) => m >= 0 && m < 3)).toBe(true);
  });
});

describe("unrollScore", () => {
  it("펼친 notes 위치와 marks 비움, 원본 불변", () => {
    const src = sc(2, [mk(1, "repeatEnd")]);
    const snapshot = JSON.stringify(src);
    const out = unrollScore(src);
    expect(out.marks).toBeUndefined();
    expect(out.notes.map((x) => [x.midi, x.startBeat])).toEqual([[60, 0], [61, 4], [60, 8], [61, 12]]);
    expect(JSON.stringify(src)).toBe(snapshot);
  });
  it("marks 없으면 같은 내용", () => {
    const out = unrollScore(sc(3));
    expect(out.notes).toEqual(whole(3));
  });
  it("chords·dynamics 도 같이 이동, 건너뛴 마디는 그 자리 셈여림을 이어받음", () => {
    const src = makeScore(whole(3), {
      marks: [mk(1, "repeatStart"), mk(2, "repeatEnd")],
      chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "F" }, { startBeat: 8, symbol: "G" }],
      dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 8, kind: "f" }],
    });
    const out = unrollScore(src);
    expect(out.chords.map((c) => [c.symbol, c.startBeat])).toEqual([["C", 0], ["F", 4], ["G", 8], ["F", 12], ["G", 16]]);
    // 마디 1 로 되돌아간 지점(12박)은 p 를 이어받고, 두 번째 G(16박)에서 다시 f
    expect(out.dynamics).toEqual([{ startBeat: 0, kind: "p" }, { startBeat: 8, kind: "f" }, { startBeat: 12, kind: "p" }, { startBeat: 16, kind: "f" }]);
  });
  it("되돌아가기 전 마디 경계를 넘는 음은 마디 끝에서 자름", () => {
    const src = makeScore([{ midi: 60, startBeat: 0, durationBeats: 4 }, { midi: 62, startBeat: 4, durationBeats: 6 }], { marks: [mk(1, "repeatEnd")] });
    const out = unrollScore(src);
    expect(out.notes.map((x) => x.durationBeats)).toEqual([4, 4, 4, 6]);
  });
});
