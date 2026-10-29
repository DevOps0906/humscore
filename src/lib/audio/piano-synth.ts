import { midiToFreq } from "../music/frequency";
import { DYNAMIC_VELOCITY, velocityAt } from "../music/dynamics";
import { unrollScore } from "../music/form";
import { chordToMidi, transposeChordSymbol, transposeKey } from "../music/theory";
import type { InstrumentId } from "../music/midi";
import { secondsPerBeat, type PlaybackPlan } from "../music/playback-plan";
import type { Score } from "../music/types";
import { playInstrumentNote } from "./instruments";

/**
 * 배음 합성 그랜드 피아노 (외부 음원 파일 0개)
 * 「Web Audio API 디지털 그랜드 피아노 악기 제작 가이드」의 배음표를 그대로 구현:
 *   기본음 + 2~5차 배음(비조화성 포함) + 해머 클릭, 6ms 어택 후 지수 감쇠
 * 이후 실제 샘플 음원(사운드폰트)으로 교체할 때도 이 인터페이스(playNote)만 유지하면 됩니다.
 */

interface Harmonic {
  mult: number;
  gain: number;
  decay: number;
  type: OscillatorType;
}

const HARMONICS: Harmonic[] = [
  { mult: 1.0, gain: 0.55, decay: 2.2, type: "triangle" },
  { mult: 2.001, gain: 0.28, decay: 1.8, type: "sine" },
  { mult: 3.004, gain: 0.16, decay: 1.3, type: "sine" },
  { mult: 4.009, gain: 0.08, decay: 0.9, type: "sine" },
  { mult: 5.016, gain: 0.04, decay: 0.6, type: "sine" },
  { mult: 0.5, gain: 0.2, decay: 0.04, type: "square" }, // 해머 타격 펄스
];

export interface PlayNoteOptions {
  /** 0~1 */
  velocity?: number;
  /** 키를 누르고 있는 시간(초). 이후 0.15초 릴리즈 */
  duration?: number;
  sustainPedal?: boolean;
  destination?: AudioNode;
}

export function playPianoNote(ctx: AudioContext, midi: number, when: number, opts: PlayNoteOptions = {}): void {
  const { velocity = 0.8, duration, sustainPedal = false, destination = ctx.destination } = opts;
  const freq = midiToFreq(midi);
  // 고음일수록 감쇠가 빠른 실제 피아노 특성 반영
  const registerFactor = Math.max(0.35, Math.min(1.4, 1.4 - (midi - 48) / 60));
  const master = ctx.createGain();
  master.gain.value = 0.35 * velocity;
  master.connect(destination);

  for (const h of HARMONICS) {
    const f = freq * h.mult;
    if (f > ctx.sampleRate / 2) continue; // 나이퀴스트 초과 배음 제거
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = h.type;
    osc.frequency.setValueAtTime(f, when);
    const natural = h.decay * registerFactor * (sustainPedal ? 2.5 : 1);
    const end = duration !== undefined && !sustainPedal ? Math.min(natural, duration + 0.15) : natural;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(h.gain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.03, end));
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + Math.max(0.03, end) + 0.02);
  }
}

/**
 * 메트로놈 클릭. level: 2 강, 1 중, 0 약(작고 짧게).
 * boolean 은 하위 호환: true = 강(2), false = 중(1)
 */
export function playClick(ctx: AudioContext, when: number, accent: boolean | 0 | 1 | 2): void {
  const level = typeof accent === "boolean" ? (accent ? 2 : 1) : accent;
  const freq = level === 2 ? 1760 : level === 1 ? 1320 : 1000;
  const peak = level === 2 ? 0.5 : level === 1 ? 0.3 : 0.14;
  const len = level === 0 ? 0.03 : 0.05;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + len);
  osc.connect(g).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + len + 0.01);
}

export interface Playback {
  stop: () => void;
  /** 재생 시작 시각(AudioContext 기준) — 커서 표시용 */
  startedAt: number;
  durationSec: number;
}

/** mf(기본) 일 때 기존 음량(멜로디 0.8, 코드 0.45)이 그대로 나오도록 셈여림을 mf 대비 배율로 적용 */
const MF = DYNAMIC_VELOCITY.mf;
const MELODY_BASE = 0.8;
const CHORD_BASE = 0.45;

/**
 * 악보 전체 재생 (멜로디 + 마디별 코드 반주), 전조 반영.
 * 도돌이표·D.C./D.S. 를 펼친 순서로 연주하고, 셈여림은 멜로디·코드 음량에 같은 비율로 반영한다.
 * durationSec 도 펼친 길이 기준.
 */
export function playScore(
  ctx: AudioContext,
  source: Score,
  opts: { withChords?: boolean; instrument?: InstrumentId } = {},
): Playback {
  const score = unrollScore(source);
  const instrument = opts.instrument ?? "piano";
  const spb = 60 / score.bpm;
  const start = ctx.currentTime + 0.1;
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const tp = score.transpose;
  const preferFlats = transposeKey(score.key, tp).fifths < 0;

  for (const n of score.notes) {
    if (n.midi === null) continue;
    playInstrumentNote(ctx, instrument, n.midi + tp, start + n.startBeat * spb, {
      duration: n.durationBeats * spb,
      velocity: Math.min(1, (MELODY_BASE * velocityAt(score.dynamics, n.startBeat)) / MF),
      destination: bus,
    });
  }
  if (opts.withChords ?? true) {
    score.chords.forEach((c, i) => {
      const end = score.chords[i + 1]?.startBeat ?? c.startBeat + score.beatsPerMeasure;
      for (const m of chordToMidi(transposeChordSymbol(c.symbol, tp, preferFlats), 3)) {
        playPianoNote(ctx, m, start + c.startBeat * spb, { velocity: Math.min(1, (CHORD_BASE * velocityAt(score.dynamics, c.startBeat)) / MF), duration: (end - c.startBeat) * spb, destination: bus });
      }
    });
  }
  const lastBeat = score.notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  return {
    startedAt: start,
    durationSec: lastBeat * spb,
    stop: () => {
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      setTimeout(() => bus.disconnect(), 100);
    },
  };
}

export interface PlanPlayback extends Playback {
  /** startedAt 시각에 소리 나는 계획 박 */
  fromBeat: number;
  /** 실제 박 길이(초) — 현재 박 = fromBeat + (ctx.currentTime − startedAt) / secondsPerBeat */
  secondsPerBeat: number;
}

/**
 * 재생 계획(buildPlaybackPlan) 예약 — 공연 모드 연습 재생용. playScore 와 같은 음색·셈여림·전조.
 * rate: 원래 bpm 대비 배율(50~100%, 합성음 일정만 바뀌어 음높이 불변).
 * fromBeat: 이 박 이후에 시작하는 음만 예약(그 박에 걸친 코드는 fromBeat 부터 남은 길이만).
 * at: fromBeat 를 울릴 시각(기본 지금 + 0.1초) — 반복 이음 미리 예약용.
 * 음·코드는 계획 끝(totalBeats)에서 자른다(마지막 코드는 길이가 없으므로).
 */
export function playPlan(
  ctx: AudioContext,
  plan: PlaybackPlan,
  opts: { rate?: number; fromBeat?: number; at?: number; withChords?: boolean; instrument?: InstrumentId } = {},
): PlanPlayback {
  const instrument = opts.instrument ?? "piano";
  const spb = secondsPerBeat(plan.bpm, opts.rate ?? 1);
  const total = plan.totalBeats;
  const from = Math.min(Math.max(0, opts.fromBeat ?? 0), total);
  const start = opts.at ?? ctx.currentTime + 0.1;
  const timeOf = (beat: number) => start + (beat - from) * spb;
  const EPS = 1e-6;
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const tp = plan.transpose;
  const preferFlats = transposeKey(plan.key, tp).fifths < 0;

  for (const n of plan.notes) {
    if (n.midi === null || n.startBeat < from - EPS || n.startBeat >= total - EPS) continue;
    const end = Math.min(total, n.startBeat + n.durationBeats);
    playInstrumentNote(ctx, instrument, n.midi + tp, timeOf(n.startBeat), {
      duration: (end - n.startBeat) * spb,
      velocity: Math.min(1, (MELODY_BASE * velocityAt(plan.dynamics, n.startBeat)) / MF),
      destination: bus,
    });
  }
  if (opts.withChords ?? true) {
    plan.chords.forEach((c, i) => {
      const end = Math.min(total, plan.chords[i + 1]?.startBeat ?? total);
      const on = Math.max(from, c.startBeat);
      if (end <= on + EPS) return;
      for (const m of chordToMidi(transposeChordSymbol(c.symbol, tp, preferFlats), 3)) {
        playPianoNote(ctx, m, timeOf(on), { velocity: Math.min(1, (CHORD_BASE * velocityAt(plan.dynamics, c.startBeat)) / MF), duration: (end - on) * spb, destination: bus });
      }
    });
  }
  return {
    startedAt: start,
    durationSec: (total - from) * spb,
    fromBeat: from,
    secondsPerBeat: spb,
    stop: () => {
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      setTimeout(() => bus.disconnect(), 100);
    },
  };
}
