"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import type { InstrumentId } from "@/lib/audio/instruments";
import { playPlan, type PlanPlayback } from "@/lib/audio/piano-synth";
import { scoreMeasureCount } from "@/lib/music/edit";
import {
  buildPlaybackPlan,
  clampRange,
  noteIndexAtBeat,
  normalizeRate,
  resumeBeatAt,
  type PlaybackPlan,
  type PlaybackRange,
} from "@/lib/music/playback-plan";
import type { Score } from "@/lib/music/types";

/** 대기 · 준비(오디오 시작 대기) · 재생 · 일시정지 · 오류(3초 안에 소리를 못 켬, 대기와 같이 다시 누를 수 있음) */
export type PlaybackStatus = "idle" | "preparing" | "playing" | "paused" | "error";

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  /** 커서를 둘 원본 score.notes 인덱스 */
  cursor: number | null;
  rate: number;
  range: PlaybackRange;
  loop: boolean;
}

export interface PlaybackDeps {
  getCtx: () => AudioContext;
  setSession: (type: "playback") => void;
  play: typeof playPlan;
  frame: (cb: () => void) => unknown;
  cancelFrame: (h: unknown) => void;
}

/** 다음 회차를 현재 회차 끝보다 이만큼 먼저 예약(초) — 실측 후 조정(R1) */
export const LOOP_LEAD_SEC = 0.5;
const START_TIMEOUT_MS = 3000;

const defaultDeps = (): PlaybackDeps => ({
  getCtx: getAudioContext,
  setSession: setAudioSessionType,
  play: playPlan,
  frame: (cb) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(cb, 16)),
  cancelFrame: (h) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(h as number) : clearTimeout(h as ReturnType<typeof setTimeout>)),
});

/** 재생 상태 기계(React 밖) — 훅과 단위 테스트가 함께 쓴다. play()·toggle() 은 제스처 핸들러 안에서 동기로 부른다. */
export class ScorePlaybackController {
  private deps: PlaybackDeps;
  private score: Score;
  private instrument: InstrumentId = "piano";
  private plan: PlaybackPlan;
  private snap: PlaybackSnapshot;
  private listeners = new Set<() => void>();
  private segments: PlanPlayback[] = [];
  /** 다음 회차 예약 또는 끝 처리 타이머(항상 하나) */
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frameHandle: unknown = null;
  private pending: (() => void) | null = null;
  private pausedBeat = 0;
  /** 사용자가 구간을 고른 적 없으면 악보가 바뀔 때 전체 마디로 맞춘다 */
  private rangeTouched = false;
  private ctx: AudioContext | null = null;

  constructor(score: Score, deps: Partial<PlaybackDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
    this.score = score;
    this.snap = { status: "idle", cursor: null, rate: 1, range: { startMeasure: 1, endMeasure: scoreMeasureCount(score) }, loop: false };
    this.plan = this.buildPlan();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  get playable(): boolean {
    return this.score.notes.some((n) => n.midi !== null);
  }

  private set(patch: Partial<PlaybackSnapshot>) {
    const next = { ...this.snap, ...patch };
    const same = (Object.keys(patch) as (keyof PlaybackSnapshot)[]).every((k) => next[k] === this.snap[k]);
    if (same) return;
    this.snap = next;
    for (const fn of this.listeners) fn();
  }

  private buildPlan() {
    return this.snap.loop ? buildPlaybackPlan(this.score, this.snap.range) : buildPlaybackPlan(this.score);
  }

  setInstrument(instrument: InstrumentId) {
    this.instrument = instrument;
  }

  /** 악보 변경(전조 등): 재생 중이면 지금 음부터 새 계획으로 이어 간다 */
  setScore(score: Score) {
    if (score === this.score) return;
    const beat = this.snap.status === "playing" ? this.currentBeat() : null;
    this.score = score;
    const range = this.rangeTouched ? clampRange(score, this.snap.range) : { startMeasure: 1, endMeasure: scoreMeasureCount(score) };
    if (range.startMeasure !== this.snap.range.startMeasure || range.endMeasure !== this.snap.range.endMeasure) this.set({ range });
    this.plan = this.buildPlan();
    if (beat !== null) this.restartFrom(resumeBeatAt(this.plan, beat));
    else if (this.snap.status === "paused") this.pausedBeat = Math.min(this.pausedBeat, this.plan.totalBeats);
  }

  setRate(rate: number) {
    const r = normalizeRate(rate);
    if (r === this.snap.rate) return;
    const beat = this.snap.status === "playing" ? this.currentBeat() : null;
    this.set({ rate: r });
    if (beat !== null) this.restartFrom(resumeBeatAt(this.plan, beat));
  }

  setRange(range: PlaybackRange) {
    const r = clampRange(this.score, range);
    this.rangeTouched = true;
    if (r.startMeasure === this.snap.range.startMeasure && r.endMeasure === this.snap.range.endMeasure) return;
    this.set({ range: r });
    if (this.snap.loop) this.replan();
  }

  setLoop(loop: boolean) {
    if (loop === this.snap.loop) return;
    this.set({ loop });
    this.replan();
  }

  /** 구간·반복이 바뀌면 계획이 달라진다: 재생 중이면 새 계획 처음부터, 일시정지면 대기로 */
  private replan() {
    const wasPlaying = this.snap.status === "playing" || this.snap.status === "preparing";
    this.plan = this.buildPlan();
    if (wasPlaying) this.restartFrom(0);
    else if (this.snap.status === "paused") this.stop();
  }

  toggle() {
    if (this.snap.status === "playing" || this.snap.status === "preparing") this.pause();
    else this.play();
  }

  /** 재생(일시정지였으면 멈춘 음부터). 제스처 핸들러 안에서 동기로 호출 */
  play() {
    if (!this.playable) return;
    const from = this.snap.status === "paused" ? this.pausedBeat : 0;
    this.clearAll();
    this.deps.setSession("playback");
    let ctx: AudioContext;
    try {
      ctx = this.deps.getCtx(); // 제스처 안 동기 호출, resume await 금지
    } catch {
      this.fail();
      return;
    }
    this.ctx = ctx;
    if (ctx.state === "running") {
      this.startAt(from);
      return;
    }
    this.set({ status: "preparing" });
    let giveUp: ReturnType<typeof setTimeout> | null = null;
    const release = () => {
      ctx.removeEventListener("statechange", onState);
      if (giveUp) clearTimeout(giveUp);
      this.pending = null;
    };
    const onState = () => {
      if (ctx.state !== "running") return;
      release();
      this.startAt(from);
    };
    ctx.addEventListener("statechange", onState);
    giveUp = setTimeout(() => {
      release();
      this.set({ status: "error" });
    }, START_TIMEOUT_MS);
    this.pending = release;
  }

  pause() {
    if (this.snap.status === "preparing") {
      this.clearAll();
      this.set({ status: this.pausedBeat > 0 ? "paused" : "idle" });
      return;
    }
    if (this.snap.status !== "playing") return;
    this.pausedBeat = resumeBeatAt(this.plan, this.currentBeat());
    this.clearAll();
    this.set({ status: "paused", cursor: noteIndexAtBeat(this.plan, this.pausedBeat) });
  }

  /** 처음으로: 재생 중이면 처음부터 다시, 아니면 대기로 */
  rewind() {
    if (this.snap.status === "playing") this.restartFrom(0);
    else this.stop();
  }

  /** 정지·정리(따라 치기 켜짐·화면 이탈) */
  stop() {
    this.clearAll();
    this.pausedBeat = 0;
    this.set({ status: "idle", cursor: null });
  }

  /** 지금 소리 나는 계획 박 */
  currentBeat(): number {
    const ctx = this.ctx;
    if (!ctx || !this.segments.length) return this.pausedBeat;
    const now = ctx.currentTime;
    let seg = this.segments[0];
    for (const s of this.segments) if (s.startedAt <= now) seg = s;
    return Math.max(seg.fromBeat, seg.fromBeat + (now - seg.startedAt) / seg.secondsPerBeat);
  }

  private restartFrom(beat: number) {
    this.clearAll();
    if (this.ctx?.state === "running") this.startAt(beat);
    else this.set({ status: "idle", cursor: null });
  }

  private startAt(fromBeat: number) {
    const ctx = this.ctx!;
    this.pausedBeat = fromBeat;
    let seg: PlanPlayback;
    try {
      seg = this.deps.play(ctx, this.plan, { rate: this.snap.rate, fromBeat, instrument: this.instrument });
    } catch {
      this.fail();
      return;
    }
    this.set({ status: "playing", cursor: noteIndexAtBeat(this.plan, fromBeat) });
    this.schedule(seg);
    this.tick();
  }

  /** 소리를 켜거나 예약하지 못함 → 정리 후 오류(다시 누르면 처음부터) */
  private fail() {
    this.clearAll();
    this.pausedBeat = 0;
    this.set({ status: "error", cursor: null });
  }

  /** 회차 하나 예약 후: 반복이면 끝 직전에 다음 회차(A부터)를 끝 시각에 맞춰 예약, 아니면 끝에서 대기로 */
  private schedule(seg: PlanPlayback) {
    const ctx = this.ctx!;
    this.segments = this.segments.filter((s) => s.startedAt + s.durationSec > ctx.currentTime - 1);
    this.segments.push(seg);
    const endAt = seg.startedAt + seg.durationSec;
    if (this.snap.loop) {
      this.timer = setTimeout(() => {
        this.timer = null;
        const at = Math.max(endAt, ctx.currentTime + 0.05); // 타이머가 늦으면(R1) 가능한 빨리
        let next: PlanPlayback;
        try {
          next = this.deps.play(ctx, this.plan, { rate: this.snap.rate, fromBeat: 0, at, instrument: this.instrument });
        } catch {
          this.fail();
          return;
        }
        this.schedule(next);
      }, Math.max(0, (endAt - LOOP_LEAD_SEC - ctx.currentTime) * 1000));
    } else {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.clearAll();
        this.pausedBeat = 0;
        this.set({ status: "idle", cursor: null });
      }, Math.max(0, (endAt - ctx.currentTime) * 1000 + 100));
    }
  }

  /** 커서: 바뀔 때만 갱신 */
  private tick = () => {
    if (this.snap.status !== "playing") return;
    const idx = noteIndexAtBeat(this.plan, this.currentBeat());
    if (idx !== null) this.set({ cursor: idx });
    this.frameHandle = this.deps.frame(this.tick);
  };

  private clearAll() {
    for (const s of this.segments) s.stop();
    this.segments = [];
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending?.();
    if (this.frameHandle !== null) this.deps.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }
}

/** 공연 모드·상세 화면 공용 연습 재생(속도·구간 반복·현재 음 커서). disabled(따라 치기 중)면 정지 */
/** 불러오는 중(score 없음)에도 훅 순서를 지키기 위한 빈 악보 */
const EMPTY_SCORE: Score = {
  id: "",
  title: "",
  bpm: 120,
  beatsPerMeasure: 4,
  beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 },
  notes: [],
  chords: [],
  transpose: 0,
  createdAt: "",
  updatedAt: "",
};

export function useScorePlayback(source: Score | null | undefined, opts: { instrument?: InstrumentId; disabled?: boolean } = {}) {
  const score = source ?? EMPTY_SCORE;
  const [controller] = useState(() => new ScorePlaybackController(score));
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => controller.setScore(score), [controller, score]);
  useEffect(() => controller.setInstrument(opts.instrument ?? "piano"), [controller, opts.instrument]);
  useEffect(() => {
    if (opts.disabled) controller.stop();
  }, [controller, opts.disabled]);
  useEffect(() => () => controller.stop(), [controller]);

  return {
    ...snap,
    playable: score.notes.some((n) => n.midi !== null),
    measureCount: scoreMeasureCount(score),
    toggle: () => controller.toggle(),
    rewind: () => controller.rewind(),
    setRate: (r: number) => controller.setRate(r),
    setRange: (r: PlaybackRange) => controller.setRange(r),
    setLoop: (l: boolean) => controller.setLoop(l),
  };
}

export type ScorePlayback = ReturnType<typeof useScorePlayback>;
