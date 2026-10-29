import { describe, expect, it } from "vitest";
import { measureOrder, unrollScore } from "../form";
import type { DynamicEvent, MeasureMark, NoteEvent } from "../types";
import { velocityAt } from "../dynamics";
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
  it("시작 기호 없는 연속 도돌이 끝: 직전 :|| 다음 마디로 되돌아감", () => {
    expect(measureOrder(sc(8, [mk(0, "repeatStart"), mk(3, "repeatEnd"), mk(7, "repeatEnd")]))).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7]);
    expect(measureOrder(sc(8, [mk(3, "repeatEnd"), mk(7, "repeatEnd")]))).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7]);
  });
  it("끝 기호 없는 repeatStart: 곡 끝까지 한 번 반복", () => {
    expect(measureOrder(sc(4, [mk(1, "repeatStart")]))).toEqual([0, 1, 2, 3, 1, 2, 3]);
    expect(measureOrder(sc(6, [mk(0, "repeatStart"), mk(1, "repeatEnd"), mk(3, "repeatStart")]))).toEqual([0, 1, 0, 1, 2, 3, 4, 5, 3, 4, 5]);
  });
  it("끝 기호 없는 repeatStart 도 D.C. 점프 이후엔 반복하지 않음", () => {
    expect(measureOrder(sc(3, [mk(1, "repeatStart"), mk(2, "dc")]))).toEqual([0, 1, 2, 1, 2, 0, 1, 2]);
  });
  it("모든 마디에 repeatEnd 여도 잘리지 않음", () => {
    const n = 12;
    const order = measureOrder(sc(n, Array.from({ length: n }, (_, i) => mk(i, "repeatEnd"))));
    expect(order.at(-1)).toBe(n - 1);
    expect(order).toHaveLength(n * 2); // 각 마디가 정확히 한 번씩 반복
    expect(order.slice(0, 6)).toEqual([0, 0, 1, 1, 2, 2]);
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
  it("cresc/dim 이 있는 구간을 펼쳐도 헤어핀 목표가 원본과 같음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "cresc", durationBeats: 4 }, { startBeat: 8, kind: "f" }, { startBeat: 12, kind: "dim", durationBeats: 4 }];
    const src = makeScore(whole(4), { dynamics, marks: [mk(3, "repeatEnd")] });
    const out = unrollScore(src);
    for (const b of [12, 13, 14, 15]) expect(velocityAt(out.dynamics, b)).toBeCloseTo(velocityAt(dynamics, b), 6);
    // 16박 이후 되돌아간 첫 마디는 p
    expect(velocityAt(out.dynamics, 16.5)).toBeCloseTo(0.42, 6);
    // 두 번째 패스의 dim(28~32박)도 같은 목표(mf)로 내려감
    expect(velocityAt(out.dynamics, 30)).toBeCloseTo(velocityAt(dynamics, 14), 6);
  });
  it("점프해 들어간 마디 첫 박에 cresc 만 있으면 승계 단계를 먼저 넣음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "f" }, { startBeat: 4, kind: "cresc", durationBeats: 4 }, { startBeat: 8, kind: "ff" }];
    const src = makeScore(whole(3), { dynamics, marks: [mk(1, "repeatStart"), mk(2, "repeatEnd")] });
    const out = unrollScore(src);
    // 두 번째 패스 마디 1 은 12박: f 로 시작해 ff 로
    expect(velocityAt(out.dynamics, 12)).toBeCloseTo(0.8, 6);
    expect(velocityAt(out.dynamics, 14)).toBeCloseTo(0.875, 6);
  });
  it("cresc 진행 중인 마디로 되돌아가도 헤어핀 진행값을 이어받음", () => {
    // p → cresc(0~8박) → f. 마디 1(4~8박)을 한 번 더: 순서 0,1,1,2
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 8 }, { startBeat: 8, kind: "f" }];
    const src = makeScore(whole(3), { dynamics, marks: [mk(1, "repeatStart"), mk(1, "repeatEnd")] });
    const out = unrollScore(src);
    // 첫 패스(0~8박)는 원본 그대로
    for (const b of [0, 2, 4, 6, 7.9]) expect(velocityAt(out.dynamics, b)).toBeCloseTo(velocityAt(dynamics, b), 6);
    // 두 번째 패스 마디 1(8~12박): 원본 4박 값(0.61)에 가장 가까운 단계(mf)에서 시작해 f 로 계속 올라감 — p 로 떨어지지 않음
    expect(Math.abs(velocityAt(out.dynamics, 8) - velocityAt(dynamics, 4))).toBeLessThan(0.06);
    expect(velocityAt(out.dynamics, 10)).toBeGreaterThan(velocityAt(out.dynamics, 8));
    expect(velocityAt(out.dynamics, 11.9)).toBeCloseTo(velocityAt(dynamics, 7.9), 1);
    expect(velocityAt(out.dynamics, 12)).toBeCloseTo(0.8, 6);
  });
  it("끝난 헤어핀 뒤 마디로 점프하면 헤어핀 목표 단계를 이어받음", () => {
    // p → cresc(0~4박, 목표 f@12). 원본 8박 velocity = f. 마디 2 반복: 순서 0,1,2,2,3
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 4 }, { startBeat: 12, kind: "f" }];
    const out = unrollScore(makeScore(whole(4), { dynamics, marks: [mk(2, "repeatStart"), mk(2, "repeatEnd")] }));
    expect(velocityAt(dynamics, 8)).toBeCloseTo(0.8, 6);
    for (const b of [8, 12, 14, 16]) expect(velocityAt(out.dynamics, b)).toBeCloseTo(0.8, 6);
  });
  /** 펼친 k 번째 마디의 velocity 가 원본 마디 order[k] 의 같은 위치와 tol 이내인지 (단계 근사 오차 허용) */
  const expectFollows = (src: ReturnType<typeof makeScore>, tol: number) => {
    const out = unrollScore(src);
    measureOrder(src).forEach((m, k) => {
      for (const o of [0, 1, 2, 3, 3.9]) expect(Math.abs(velocityAt(out.dynamics, k * 4 + o) - velocityAt(src.dynamics, m * 4 + o))).toBeLessThan(tol);
    });
    return out;
  };
  it("긴 cresc 에 여러 번 점프해 들어가도 보정 기호가 진행 중인 사본을 끊지 않음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 12 }, { startBeat: 12, kind: "f" }];
    const src = makeScore(whole(4), { dynamics, marks: [mk(1, "repeatEnd"), mk(2, "repeatEnd")] });
    expect(measureOrder(src)).toEqual([0, 1, 0, 1, 2, 2, 3]);
    expectFollows(src, 0.08);
  });
  it("긴 dim 에 여러 번 점프해 들어가도 보정 기호가 진행 중인 사본을 끊지 않음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "f" }, { startBeat: 0, kind: "dim", durationBeats: 12 }, { startBeat: 12, kind: "p" }];
    const src = makeScore(whole(4), { dynamics, marks: [mk(1, "repeatStart"), mk(1, "repeatEnd"), mk(2, "repeatEnd")] });
    expect(measureOrder(src)).toEqual([0, 1, 1, 2, 2, 3]);
    expectFollows(src, 0.08);
  });
  it("D.S. al Coda 로 cresc 중간에 들어가면 헤어핀 사본은 한 번만 생김", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 12 }, { startBeat: 12, kind: "f" }];
    const src = makeScore(whole(5), { dynamics, marks: [mk(1, "segno"), mk(2, "toCoda"), mk(3, "dsAlCoda"), mk(4, "coda")] });
    expect(measureOrder(src)).toEqual([0, 1, 2, 3, 1, 2, 4]);
    const out = expectFollows(src, 0.08);
    expect(out.dynamics!.filter((d) => d.kind === "cresc").map((d) => [d.startBeat, d.durationBeats])).toEqual([[0, 12], [16, 8]]);
  });
  // p → cresc(0~8) → f → dim(8~16) → pp, 5마디
  const crescDim: DynamicEvent[] = [
    { startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 8 }, { startBeat: 8, kind: "f" }, { startBeat: 8, kind: "dim", durationBeats: 8 }, { startBeat: 16, kind: "pp" },
  ];
  it("구간 단위 닫힘: 이탈 목표가 다른 헤어핀 사본의 목표를 바꾸지 않음", () => {
    const src = makeScore(whole(5), { dynamics: crescDim, marks: [mk(0, "repeatStart"), mk(0, "repeatEnd"), mk(2, "repeatEnd")] });
    expect(measureOrder(src)).toEqual([0, 0, 1, 2, 1, 2, 3, 4]);
    const out = expectFollows(src, 0.08);
    expect(velocityAt(out.dynamics, 2)).toBeCloseTo(0.535, 6);
    expect(velocityAt(out.dynamics, 16)).toBeCloseTo(0.65, 6);
    expect(velocityAt(out.dynamics, 18)).toBeCloseTo(0.725, 6);
    expect(velocityAt(out.dynamics, 24)).toBeCloseTo(0.55, 6);
    // 경계 박 16: 이탈 목표(mp) 가 다음 진입 기호(mf) 보다 앞
    const dyn = out.dynamics!;
    const at16 = (kind: DynamicEvent["kind"]) => dyn.findIndex((d) => d.startBeat === 16 && d.kind === kind);
    expect(at16("mp")).toBeGreaterThanOrEqual(0);
    expect(at16("mp")).toBeLessThan(at16("mf"));
  });
  it.each([
    ["도돌이표", [mk(1, "repeatStart"), mk(2, "repeatEnd")]],
    ["D.C.", [mk(2, "dc")]],
    ["D.S. al Coda", [mk(1, "segno"), mk(2, "toCoda"), mk(3, "dsAlCoda"), mk(4, "coda")]],
  ] as [string, MeasureMark[]][])("%s: 펼친 셈여림이 원본을 따르고, 헤어핀 사본은 다음 점프 박을 넘지 않음", (_name, marks) => {
    const src = makeScore(whole(5), { dynamics: crescDim, marks });
    const out = expectFollows(src, 0.08);
    const order = measureOrder(src);
    const jumps = order.flatMap((m, k) => (k + 1 < order.length && order[k + 1] !== m + 1 ? [(k + 1) * 4] : []));
    for (const d of out.dynamics!) {
      if (d.kind !== "cresc" && d.kind !== "dim") continue;
      const next = jumps.find((j) => j > d.startBeat + 1e-6);
      if (next !== undefined) expect(d.startBeat + (d.durationBeats ?? 0)).toBeLessThanOrEqual(next + 1e-6);
    }
  });
  it.each([
    ["D.C. al Fine", 4, [mk(1, "fine"), mk(3, "dcAlFine")], [0, 1, 2, 3, 0, 1]],
    ["D.S. al Fine", 5, [mk(1, "segno"), mk(2, "fine"), mk(4, "dsAlFine")], [0, 1, 2, 3, 4, 1, 2]],
  ] as [string, number, MeasureMark[], number[]][])("%s: 원본 중간에서 끝나는 마지막 구간도 헤어핀을 닫음", (_name, count, marks, order) => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 12 }, { startBeat: 12, kind: "f" }];
    const src = makeScore(whole(count), { dynamics, marks });
    expect(measureOrder(src)).toEqual(order);
    const out = expectFollows(src, 0.08);
    const total = order.length * 4;
    for (const d of out.dynamics!) if (d.kind === "cresc") expect(d.startBeat + (d.durationBeats ?? 0)).toBeLessThanOrEqual(total + 1e-6);
  });
  it("원본 마지막 마디로 끝나는 마지막 구간은 헤어핀을 자르지 않음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "p" }, { startBeat: 8, kind: "cresc", durationBeats: 8 }];
    const out = unrollScore(makeScore(whole(3), { dynamics, marks: [mk(0, "repeatEnd")] }));
    expect(out.dynamics).toEqual([{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "p" }, { startBeat: 12, kind: "cresc", durationBeats: 8 }]);
  });
  it("점프해 들어간 마디 첫 박에 단계 기호가 있으면 승계 이벤트를 넣지 않음", () => {
    const dynamics: DynamicEvent[] = [{ startBeat: 0, kind: "f" }, { startBeat: 4, kind: "p" }];
    const out = unrollScore(makeScore(whole(2), { dynamics, marks: [mk(1, "repeatEnd")] }));
    expect(out.dynamics!.filter((d) => Math.abs(d.startBeat - 12) < 1e-6)).toHaveLength(1);
  });
  it("점프해 들어간 마디 첫 박에 코드가 없으면 그 자리의 유효 코드를 넣음", () => {
    const src = makeScore(whole(4), {
      marks: [mk(2, "repeatStart"), mk(3, "repeatEnd")],
      chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "F" }, { startBeat: 12, symbol: "G" }],
    });
    const out = unrollScore(src);
    // 마디 3 (G) 뒤 16박에 마디 2 로 되돌아감 -> 원래 그 자리 코드는 F(4박 코드가 이어짐)
    expect(out.chords.map((c) => [c.symbol, c.startBeat])).toEqual([["C", 0], ["F", 4], ["G", 12], ["F", 16], ["G", 20]]);
  });
});
