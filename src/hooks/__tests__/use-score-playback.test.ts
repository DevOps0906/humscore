import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanPlayback } from "@/lib/audio/piano-synth";
import type { PlaybackPlan } from "@/lib/music/playback-plan";
import type { NoteEvent, Score } from "@/lib/music/types";
import { LOOP_LEAD_SEC, ScorePlaybackController } from "../use-score-playback";

const n = (midi: number | null, startBeat: number, durationBeats = 1): NoteEvent => ({ midi, startBeat, durationBeats });
function mk(notes: NoteEvent[]): Score {
  return { id: "t", title: "t", bpm: 60, beatsPerMeasure: 4, beatUnit: 4, key: { tonic: 0, mode: "major", fifths: 0 }, notes, chords: [], transpose: 0, createdAt: "", updatedAt: "" };
}
/** 4/4 두 마디, 박마다 한 음, bpm 60(박당 1초) */
const twoBars = () => mk(Array.from({ length: 8 }, (_, i) => n(60 + i, i)));

type Call = { plan: PlaybackPlan; rate: number; fromBeat: number; at?: number; stopped: boolean };

function setup(score = twoBars(), state: AudioContextState = "running") {
  const listeners = new Set<() => void>();
  const ctx = {
    currentTime: 0,
    state,
    addEventListener: (_: string, h: () => void) => listeners.add(h),
    removeEventListener: (_: string, h: () => void) => listeners.delete(h),
  };
  const calls: Call[] = [];
  const play = vi.fn((_c: AudioContext, plan: PlaybackPlan, o: { rate?: number; fromBeat?: number; at?: number } = {}) => {
    const rate = o.rate ?? 1;
    const fromBeat = o.fromBeat ?? 0;
    const spb = 60 / (plan.bpm * rate);
    const call: Call = { plan, rate, fromBeat, at: o.at, stopped: false };
    calls.push(call);
    const pb: PlanPlayback = { startedAt: o.at ?? ctx.currentTime + 0.1, durationSec: (plan.totalBeats - fromBeat) * spb, fromBeat, secondsPerBeat: spb, stop: () => (call.stopped = true) };
    return pb;
  });
  const c = new ScorePlaybackController(score, {
    getCtx: () => ctx as unknown as AudioContext,
    setSession: () => {},
    play: play as never,
    frame: () => 0,
    cancelFrame: () => {},
  });
  /** 오디오 시계와 타이머를 함께 진행 */
  const advance = (sec: number) => {
    ctx.currentTime += sec;
    vi.advanceTimersByTime(sec * 1000);
  };
  const fire = () => listeners.forEach((h) => h());
  return { c, ctx, calls, advance, fire };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("ScorePlaybackController (A5)", () => {
  it("재생→일시정지→재개: 멈춘 음의 시작 박부터 다시 예약, 앞 예약은 정지", () => {
    const { c, calls, advance } = setup();
    c.play();
    expect(c.getSnapshot().status).toBe("playing");
    expect(calls[0].fromBeat).toBe(0);
    advance(3.6); // 시작 0.1초 → 박 3.5 (음 3 울리는 중)
    expect(c.getSnapshot().cursor).toBe(0); // 시작 음. tick 은 frame 주입으로 멈춤 → pause 때 갱신
    c.pause();
    expect(calls[0].stopped).toBe(true);
    expect(c.getSnapshot()).toMatchObject({ status: "paused", cursor: 3 });
    c.play();
    expect(calls).toHaveLength(2);
    expect(calls[1].fromBeat).toBe(3);
    expect(c.getSnapshot().status).toBe("playing");
  });

  it("반복 켜짐: B 끝 직전에 A(박 0)를 B 끝 시각에 예약", () => {
    const { c, calls, advance } = setup();
    c.setRange({ startMeasure: 2, endMeasure: 2 });
    c.setLoop(true);
    c.play();
    expect(calls[0].plan.totalBeats).toBe(4);
    expect(calls[0].plan.notes[0].noteIndex).toBe(4);
    const endAt = 0.1 + 4; // 박당 1초 × 4박
    advance(endAt - LOOP_LEAD_SEC - 0.01);
    expect(calls).toHaveLength(1);
    advance(0.02);
    expect(calls).toHaveLength(2);
    expect(calls[1].fromBeat).toBe(0);
    expect(calls[1].at).toBeCloseTo(endAt, 6);
    expect(calls[0].stopped).toBe(false); // 앞 회차는 끝까지 울린다
    advance(4);
    expect(calls).toHaveLength(3);
    expect(c.getSnapshot().status).toBe("playing");
  });

  it("반복 꺼짐: 끝나면 대기로, 커서 없음", () => {
    const { c, calls, advance } = setup();
    c.play();
    advance(8.3);
    expect(calls).toHaveLength(1);
    expect(c.getSnapshot()).toMatchObject({ status: "idle", cursor: null });
  });

  it("속도 변경 중이면 지금 음부터 새 속도로 다시 예약", () => {
    const { c, calls, advance } = setup();
    c.play();
    advance(2.4);
    c.setRate(0.73);
    expect(c.getSnapshot().rate).toBe(0.7);
    expect(calls[1]).toMatchObject({ rate: 0.7, fromBeat: 2 });
    expect(calls[0].stopped).toBe(true);
  });

  it("오디오가 3초 안에 안 켜지면 오류, running 되면 재생", () => {
    const a = setup(twoBars(), "suspended");
    a.c.play();
    expect(a.c.getSnapshot().status).toBe("preparing");
    vi.advanceTimersByTime(3000);
    expect(a.c.getSnapshot().status).toBe("error");
    expect(a.calls).toHaveLength(0);

    const b = setup(twoBars(), "suspended");
    b.c.play();
    b.ctx.state = "running";
    b.fire();
    expect(b.c.getSnapshot().status).toBe("playing");
    vi.advanceTimersByTime(3000);
    expect(b.c.getSnapshot().status).toBe("playing");
  });

  it("음표가 없으면 재생하지 않고, stop 은 대기·커서 없음", () => {
    const e = setup(mk([n(null, 0)]));
    e.c.play();
    expect(e.calls).toHaveLength(0);
    const { c, calls } = setup();
    c.play();
    c.stop();
    expect(calls[0].stopped).toBe(true);
    expect(c.getSnapshot()).toMatchObject({ status: "idle", cursor: null });
  });

  it("구간을 고르지 않았으면 악보가 바뀔 때 전체 마디로 맞춘다", () => {
    const { c } = setup(mk([n(60, 0)]));
    expect(c.getSnapshot().range).toEqual({ startMeasure: 1, endMeasure: 1 });
    c.setScore(twoBars());
    expect(c.getSnapshot().range).toEqual({ startMeasure: 1, endMeasure: 2 });
  });

  it("getCtx 가 동기 throw 하면 오류", () => {
    const { c } = setup();
    const bad = new ScorePlaybackController(twoBars(), {
      getCtx: () => { throw new Error("no audio"); },
      setSession: () => {},
      frame: () => 0,
      cancelFrame: () => {},
    });
    bad.play();
    expect(bad.getSnapshot().status).toBe("error");
    expect(c.getSnapshot().status).toBe("idle");
  });

  it("예약(play)이 throw 하면 재생에 머물지 않고 오류, 반복 회차 throw 도 오류", () => {
    const a = setup();
    a.c.setLoop(true);
    let n = 0;
    const orig = a.c["deps"].play;
    a.c["deps"].play = ((...args: Parameters<typeof orig>) => {
      if (++n === 1) throw new Error("schedule");
      if (n === 3) throw new Error("loop");
      return orig(...args);
    }) as typeof orig;
    a.c.play();
    expect(a.c.getSnapshot()).toMatchObject({ status: "error", cursor: null });
    a.c.play(); // 두 번째: 성공
    expect(a.c.getSnapshot().status).toBe("playing");
    a.advance(8); // 다음 회차 예약에서 throw
    expect(a.c.getSnapshot().status).toBe("error");
  });

  it("반복 중 타이머는 항상 하나", () => {
    const { c, advance } = setup();
    c.setLoop(true);
    c.play();
    advance(30);
    expect(vi.getTimerCount()).toBe(1);
  });
});
