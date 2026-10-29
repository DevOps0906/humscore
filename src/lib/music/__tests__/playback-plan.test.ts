import { describe, expect, it } from "vitest";
import {
  PLAYBACK_RATES,
  buildPlaybackPlan,
  clampRange,
  noteIndexAtBeat,
  normalizeRate,
  resumeBeatAt,
  secondsPerBeat,
} from "../playback-plan";
import { unrollScore } from "../form";
import { velocityAt } from "../dynamics";
import type { NoteEvent, Score } from "../types";

function mk(notes: NoteEvent[], extra: Partial<Score> = {}): Score {
  return {
    id: "t",
    title: "t",
    bpm: 120,
    beatsPerMeasure: 4,
    beatUnit: 4,
    key: { tonic: 0, mode: "major", fifths: 0 },
    notes,
    chords: [],
    transpose: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}
const n = (midi: number | null, startBeat: number, durationBeats = 1): NoteEvent => ({ midi, startBeat, durationBeats });
/** 4/4 세 마디, 박마다 한 음: 마디 k 의 음 = 60 + k*4 + 박 */
const threeBars = () => Array.from({ length: 12 }, (_, i) => n(60 + i, i));

describe("buildPlaybackPlan — 구간 없음 (A1)", () => {
  it("음 시작 박·길이·MIDI 가 unrollScore 와 같다 (도돌이표 포함)", () => {
    const s = mk(threeBars(), { marks: [{ measure: 0, kind: "repeatStart" }, { measure: 1, kind: "repeatEnd" }] });
    const plan = buildPlaybackPlan(s);
    const un = unrollScore(s);
    expect(plan.notes.map(({ startBeat, durationBeats, midi }) => ({ startBeat, durationBeats, midi }))).toEqual(
      un.notes.map(({ startBeat, durationBeats, midi }) => ({ startBeat, durationBeats, midi })),
    );
    expect(plan.chords).toEqual(un.chords);
    expect(plan.range).toBeNull();
    expect(plan.totalBeats).toBe(20);
  });

  it("원본 인덱스: 반복된 음은 같은 원본 인덱스를 가리킨다", () => {
    const s = mk(threeBars(), { marks: [{ measure: 0, kind: "repeatStart" }, { measure: 1, kind: "repeatEnd" }] });
    const plan = buildPlaybackPlan(s);
    for (const p of plan.notes) expect(s.notes[p.noteIndex].midi).toBe(p.midi);
    expect(plan.notes.map((p) => p.noteIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("D.C. 악보도 unrollScore 와 같다", () => {
    const s = mk(threeBars(), { marks: [{ measure: 2, kind: "dc" }] });
    expect(buildPlaybackPlan(s).notes.map((p) => p.midi)).toEqual(unrollScore(s).notes.map((x) => x.midi));
  });

  it("빈 악보: 음 없음, 길이 0, 커서 null", () => {
    const plan = buildPlaybackPlan(mk([]));
    expect(plan.notes).toEqual([]);
    expect(plan.totalBeats).toBe(0);
    expect(noteIndexAtBeat(plan, 0)).toBeNull();
    expect(resumeBeatAt(plan, 0)).toBe(0);
  });

  it("전조·bpm·key 를 그대로 넘기고 MIDI 는 원본", () => {
    const plan = buildPlaybackPlan(mk([n(60, 0)], { transpose: 2, bpm: 90 }));
    expect(plan.notes[0].midi).toBe(60);
    expect(plan.transpose).toBe(2);
    expect(plan.bpm).toBe(90);
  });
});

describe("buildPlaybackPlan — A–B 구간 (A2)", () => {
  it("구간 안 도돌이표 무시, A→B 한 번, 박은 0부터", () => {
    const s = mk(threeBars(), { marks: [{ measure: 1, kind: "repeatStart" }, { measure: 2, kind: "repeatEnd" }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 3 });
    expect(plan.notes.map((p) => p.midi)).toEqual([64, 65, 66, 67, 68, 69, 70, 71]);
    expect(plan.notes[0].startBeat).toBe(0);
    expect(plan.notes.map((p) => p.noteIndex)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(plan.totalBeats).toBe(8);
    expect(plan.range).toEqual({ startMeasure: 2, endMeasure: 3 });
  });

  it("B 끝을 넘는 음은 B 끝에서 자른다", () => {
    const s = mk([n(60, 0, 4), n(62, 4, 2), n(64, 6, 4), n(65, 10, 2)]);
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    expect(plan.notes).toEqual([
      { startBeat: 0, durationBeats: 2, midi: 62, noteIndex: 1 },
      { startBeat: 2, durationBeats: 2, midi: 64, noteIndex: 2 },
    ]);
    expect(plan.totalBeats).toBe(4);
  });

  it("첫 박에 코드가 없으면 직전 코드를 0박에 보충", () => {
    const s = mk(threeBars(), { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 2, symbol: "G" }, { startBeat: 6, symbol: "F" }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    expect(plan.chords).toEqual([
      { startBeat: 0, symbol: "G" },
      { startBeat: 2, symbol: "F" },
    ]);
  });

  it("첫 박에 코드가 있으면 보충하지 않는다", () => {
    const s = mk(threeBars(), { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "Am" }] });
    expect(buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 3 }).chords).toEqual([{ startBeat: 0, symbol: "Am" }]);
  });

  it("셈여림: 구간 시작 단계를 이어받는다", () => {
    const s = mk(threeBars(), { dynamics: [{ startBeat: 0, kind: "f" }, { startBeat: 9, kind: "p" }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 3 });
    expect(plan.dynamics).toEqual([{ startBeat: 0, kind: "f" }, { startBeat: 5, kind: "p" }]);
  });

  it("셈여림: 헤어핀 목표가 구간 밖이면 끝에 목표 단계를 명시", () => {
    const s = mk(threeBars(), { dynamics: [{ startBeat: 4, kind: "cresc", durationBeats: 4 }, { startBeat: 8, kind: "ff" }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    expect(velocityAt(plan.dynamics, 4)).toBeCloseTo(velocityAt(s.dynamics, 8));
  });

  it("셈여림: 구간 앞에서 시작한 헤어핀이 걸치면 보간값·남은 변화 보존 (회귀)", () => {
    const s = mk(threeBars(), { dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 8 }, { startBeat: 8, kind: "ff" }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    for (const b of [0, 1, 2.5, 3.9]) expect(velocityAt(plan.dynamics, b)).toBeCloseTo(velocityAt(s.dynamics, b + 4));
    expect(velocityAt(plan.dynamics, 0)).toBeCloseTo(0.685);
  });

  it("셈여림: 구간 앞에서 끝난 헤어핀의 목표 단계를 이어받는다", () => {
    const s = mk(threeBars(), { dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 0, kind: "cresc", durationBeats: 2 }] });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 3 });
    expect(velocityAt(plan.dynamics, 0)).toBeCloseTo(velocityAt(s.dynamics, 4));
  });

  it("한 마디 구간(첫 마디)", () => {
    const plan = buildPlaybackPlan(mk(threeBars()), { startMeasure: 1, endMeasure: 1 });
    expect(plan.notes.map((p) => p.noteIndex)).toEqual([0, 1, 2, 3]);
    expect(plan.totalBeats).toBe(4);
  });

  it("6/8(beatsPerMeasure=3) 마디 경계", () => {
    const s = mk(Array.from({ length: 6 }, (_, i) => n(60 + i, i)), { beatsPerMeasure: 3, meter: "6/8" });
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    expect(plan.notes.map((p) => p.noteIndex)).toEqual([3, 4, 5]);
    expect(plan.totalBeats).toBe(3);
  });

  it("범위 보정: 1..N, A ≤ B, 정수", () => {
    const s = mk(threeBars());
    expect(clampRange(s, { startMeasure: 0, endMeasure: 9 })).toEqual({ startMeasure: 1, endMeasure: 3 });
    expect(clampRange(s, { startMeasure: 3, endMeasure: 1 })).toEqual({ startMeasure: 3, endMeasure: 3 });
    expect(clampRange(s, { startMeasure: 1.6, endMeasure: NaN })).toEqual({ startMeasure: 2, endMeasure: 2 });
  });

  it("쉼표만 있는 구간: 쉼표가 계획에 남고 커서는 쉼표", () => {
    const s = mk([...threeBars().slice(0, 4), n(null, 4, 4), ...threeBars().slice(8)]);
    const plan = buildPlaybackPlan(s, { startMeasure: 2, endMeasure: 2 });
    expect(plan.notes).toEqual([{ startBeat: 0, durationBeats: 4, midi: null, noteIndex: 4 }]);
    expect(plan.notes.every((p) => p.midi === null)).toBe(true);
    expect(noteIndexAtBeat(plan, 3.5)).toBe(4);
  });
});

describe("noteIndexAtBeat (A3)", () => {
  const s = mk([n(60, 0), n(null, 1), n(64, 2, 2), n(67, 2, 2), n(62, 2, 2), n(65, 4)]);
  const plan = buildPlaybackPlan(s);

  it("경계 박: 시작 박 정각엔 그 음, 직전엔 앞 음", () => {
    expect(noteIndexAtBeat(plan, 0)).toBe(0);
    expect(noteIndexAtBeat(plan, 0.999)).toBe(0);
    expect(noteIndexAtBeat(plan, 1)).toBe(1);
    expect(noteIndexAtBeat(plan, 4)).toBe(5);
  });

  it("쉼표 동안 커서는 쉼표 음표", () => {
    expect(noteIndexAtBeat(plan, 1.5)).toBe(1);
  });

  it("화음은 맨 위 음", () => {
    expect(noteIndexAtBeat(plan, 2)).toBe(3);
    expect(noteIndexAtBeat(plan, 3.9)).toBe(3);
  });

  it("범위 밖(음수·끝 이후)은 null", () => {
    expect(noteIndexAtBeat(plan, -0.1)).toBeNull();
    expect(noteIndexAtBeat(plan, plan.totalBeats)).toBeNull();
    expect(noteIndexAtBeat(plan, NaN)).toBeNull();
  });

  it("도돌이 두 번째 회차도 원본 인덱스", () => {
    const r = mk(threeBars().slice(0, 4), { marks: [{ measure: 0, kind: "repeatEnd" }] });
    const p = buildPlaybackPlan(r);
    expect(noteIndexAtBeat(p, 5)).toBe(1);
  });

  it("resumeBeatAt: 멈춘 음의 시작 박", () => {
    expect(resumeBeatAt(plan, 3.2)).toBe(2);
    expect(resumeBeatAt(plan, 0.5)).toBe(0);
  });
});

describe("속도", () => {
  it("단계는 50~100% 10% 단위", () => {
    expect([...PLAYBACK_RATES]).toEqual([0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it("50%·100% 경계와 범위 밖 보정", () => {
    expect(normalizeRate(0.5)).toBe(0.5);
    expect(normalizeRate(1)).toBe(1);
    expect(normalizeRate(0.2)).toBe(0.5);
    expect(normalizeRate(1.5)).toBe(1);
    expect(normalizeRate(0.74)).toBe(0.7);
    expect(normalizeRate(NaN)).toBe(1);
  });

  it("박 길이 = 60 / (bpm × rate)", () => {
    expect(secondsPerBeat(120, 1)).toBeCloseTo(0.5);
    expect(secondsPerBeat(120, 0.5)).toBeCloseTo(1);
    expect(secondsPerBeat(90, 0.7)).toBeCloseTo(60 / 63);
  });
});
