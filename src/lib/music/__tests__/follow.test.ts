import { describe, expect, it } from "vitest";
import {
  FOLLOW_RELEASE_SILENT_FRAMES,
  FOLLOW_STABLE_FRAMES,
  buildFollowPlan,
  buildTargets,
  createFollowState,
  isFollowDone,
  judge,
  resetFollow,
  type FollowInput,
  type FollowState,
} from "../follow";
import { midiToFreq } from "../frequency";
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
const n = (midi: number | null, startBeat: number): NoteEvent => ({ midi, startBeat, durationBeats: 1 });

const frame = (midi: number, extraCents = 0, rms = 0.1, clarity = 0.97): FollowInput => ({
  kind: "frame",
  freq: midiToFreq(midi) * Math.pow(2, extraCents / 1200),
  clarity,
  rms,
});
const silence: FollowInput = { kind: "frame", freq: null, clarity: 0, rms: 0 };

function feed(s: FollowState, inputs: FollowInput[], t = 0) {
  let state = s;
  let last = judge(s, inputs[0], t).result;
  for (const i of inputs) {
    const r = judge(state, i, t);
    state = r.state;
    last = r.result;
  }
  return { state, last };
}
const rep = (i: FollowInput, k: number) => Array.from({ length: k }, () => i);

describe("buildTargets", () => {
  it("쉼표 제외", () => {
    expect(buildTargets(mk([n(60, 0), n(null, 1), n(62, 2)]))).toEqual([60, 62]);
  });
  it("전조 적용", () => {
    expect(buildTargets(mk([n(60, 0), n(62, 1)], { transpose: 2 }))).toEqual([62, 64]);
  });
  it("화음은 맨 위 음", () => {
    expect(buildTargets(mk([n(60, 0), n(67, 0), n(64, 0), n(62, 1)]))).toEqual([67, 62]);
  });
  it("도돌이표 펼침", () => {
    const s = mk([n(60, 0), n(62, 4)], {
      marks: [
        { measure: 0, kind: "repeatStart" },
        { measure: 1, kind: "repeatEnd" },
      ],
    });
    expect(buildTargets(s)).toEqual([60, 62, 60, 62]);
  });
});

describe("judge (마이크)", () => {
  const s0 = () => createFollowState([60, 62], 1000);

  it("안정 프레임 미달이면 진행 안 함", () => {
    const { state, last } = feed(s0(), rep(frame(60), FOLLOW_STABLE_FRAMES - 1));
    expect(last.kind).toBe("none");
    expect(state.index).toBe(0);
  });
  it("안정 프레임 충족 시 정답", () => {
    const { state, last } = feed(s0(), rep(frame(60), FOLLOW_STABLE_FRAMES), 1500);
    expect(last.kind).toBe("correct");
    expect(state.index).toBe(1);
  });
  it("중간에 다른 음이 끼면 카운트 리셋", () => {
    const { state } = feed(s0(), [frame(60), frame(60), frame(61), frame(60), frame(60)]);
    expect(state.index).toBe(0);
  });
  it("낮은 clarity 는 무시", () => {
    const { last } = feed(s0(), rep(frame(60, 0, 0.1, 0.5), 5));
    expect(last.kind).toBe("none");
  });
  it("±50센트 경계: 49센트는 같은 음, 51센트는 다음 음으로 판정", () => {
    const a = feed(s0(), rep(frame(60, 49), 3));
    expect(a.last.kind).toBe("correct");
    const b = feed(s0(), rep(frame(60, 51), 3));
    expect(b.last.heard).toBe(61);
    expect(b.last.kind).toBe("wrong");
  });
  it("오답은 진행 없이 횟수 증가", () => {
    const { state, last } = feed(s0(), rep(frame(65), 3));
    expect(last.kind).toBe("wrong");
    expect(state.index).toBe(0);
    expect(state.wrongCount).toBe(1);
  });
  it("옥타브만 다르면 octave + 오답 집계, 진행 안 함", () => {
    const { state, last } = feed(s0(), rep(frame(72), 3));
    expect(last.kind).toBe("octave");
    expect(state.index).toBe(0);
    expect(state.wrongCount).toBe(1);
  });
  it("같은 오답을 계속 내도 한 번만 집계", () => {
    const { state } = feed(s0(), rep(frame(65), 20));
    expect(state.wrongCount).toBe(1);
  });
  it("같은 음 연속: 무음 전에는 재판정 안 함, 무음 후엔 판정", () => {
    const s = createFollowState([60, 60], 0);
    const a = feed(s, rep(frame(60), 3));
    const b = feed(a.state, rep(frame(60), 10));
    expect(b.state.index).toBe(1);
    const c = feed(b.state, [...rep(silence, FOLLOW_RELEASE_SILENT_FRAMES), ...rep(frame(60), 3)]);
    expect(c.state.index).toBe(2);
    expect(c.last.finished).toBe(true);
  });
  it("같은 음 연속: rms 재상승으로도 재판정", () => {
    const s = createFollowState([60, 60], 0);
    const a = feed(s, rep(frame(60, 0, 0.1), 3));
    const b = feed(a.state, [frame(60, 0, 0.02), frame(60, 0, 0.02)]);
    const c = feed(b.state, rep(frame(60, 0, 0.2), 3));
    expect(c.state.index).toBe(2);
  });
});

describe("judge (MIDI)", () => {
  it("즉시 판정, 같은 음 연속도 on 마다 진행", () => {
    let r = judge(createFollowState([60, 60], 0), { kind: "midi", midi: 60 }, 10);
    expect(r.result.kind).toBe("correct");
    r = judge(r.state, { kind: "midi", midi: 60 }, 20);
    expect(r.result.finished).toBe(true);
  });
  it("틀린 음 / 옥타브", () => {
    const s = createFollowState([60], 0);
    expect(judge(s, { kind: "midi", midi: 61 }, 1).result.kind).toBe("wrong");
    expect(judge(s, { kind: "midi", midi: 72 }, 1).result.kind).toBe("octave");
  });
});

describe("완료 상태", () => {
  it("시각·횟수 기록, 이후 입력은 done, 불변, 리셋", () => {
    const s = createFollowState([60], 1000);
    const w = judge(s, { kind: "midi", midi: 62 }, 1100);
    expect(s.wrongCount).toBe(0);
    const d = judge(w.state, { kind: "midi", midi: 60 }, 4000);
    expect(d.result).toMatchObject({ kind: "correct", finished: true, wrongCount: 1, startedAtMs: 1000, finishedAtMs: 4000 });
    expect(isFollowDone(d.state)).toBe(true);
    expect(judge(d.state, { kind: "midi", midi: 60 }, 5000).result.kind).toBe("done");
    expect(isFollowDone(resetFollow(d.state, 6000))).toBe(false);
  });
  it("목표가 없으면 바로 done", () => {
    expect(judge(createFollowState([], 0), { kind: "midi", midi: 60 }, 1).result.kind).toBe("done");
  });
});

describe("잠금 중 배음 무시", () => {
  it("정답 확정 뒤 locked+12/+19 프레임이 와도 오답으로 세지 않는다", () => {
    const s0 = createFollowState([60, 64], 0);
    const a = feed(s0, [frame(60), frame(60), frame(60)]);
    expect(a.last.kind).toBe("correct");
    const b = feed(a.state, [frame(72), frame(72), frame(72), frame(79), frame(79), frame(79), frame(48), frame(48), frame(48)]);
    expect(b.state.wrongCount).toBe(0);
    expect(b.state.lockedMidi).toBe(60);
  });
});

describe("buildFollowPlan", () => {
  it("원본 인덱스·화음·도돌이표 펼침을 반영한다", () => {
    const score = mk([n(60, 0), n(67, 0), n(null, 1), n(62, 2), n(64, 4)], {
      transpose: 2,
      marks: [{ measure: 0, kind: "repeatEnd" }],
    });
    const plan = buildFollowPlan(score);
    expect(plan.targets).toEqual(buildTargets(score));
    expect(plan.targets).toEqual([69, 64, 69, 64, 66]);
    expect(plan.noteIndexes).toEqual([1, 3, 1, 3, 4]);
    expect(plan.hasChord).toBe(true);
  });
});
