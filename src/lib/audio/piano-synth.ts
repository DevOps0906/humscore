import { midiToFreq } from "../music/frequency";
import { chordToMidi, transposeChordSymbol, transposeKey } from "../music/theory";
import type { Score } from "../music/types";

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

/** 메트로놈 클릭 (첫 박 강세) */
export function playClick(ctx: AudioContext, when: number, accent: boolean): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(g).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 0.06);
}

export interface Playback {
  stop: () => void;
  /** 재생 시작 시각(AudioContext 기준) — 커서 표시용 */
  startedAt: number;
  durationSec: number;
}

/** 악보 전체 재생 (멜로디 + 마디별 코드 반주), 전조 반영 */
export function playScore(ctx: AudioContext, score: Score, opts: { withChords?: boolean } = {}): Playback {
  const spb = 60 / score.bpm;
  const start = ctx.currentTime + 0.1;
  const bus = ctx.createGain();
  bus.connect(ctx.destination);
  const tp = score.transpose;
  const preferFlats = transposeKey(score.key, tp).fifths < 0;

  for (const n of score.notes) {
    if (n.midi === null) continue;
    playPianoNote(ctx, n.midi + tp, start + n.startBeat * spb, { duration: n.durationBeats * spb, destination: bus });
  }
  if (opts.withChords ?? true) {
    score.chords.forEach((c, i) => {
      const end = score.chords[i + 1]?.startBeat ?? c.startBeat + score.beatsPerMeasure;
      for (const m of chordToMidi(transposeChordSymbol(c.symbol, tp, preferFlats), 3)) {
        playPianoNote(ctx, m, start + c.startBeat * spb, { velocity: 0.45, duration: (end - c.startBeat) * spb, destination: bus });
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
