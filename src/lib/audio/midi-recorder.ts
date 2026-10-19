import { getAudioContext } from "./context";
import { outputLatencySec } from "./latency";
import { playClick } from "./piano-synth";
import type { MidiEvent } from "./midi-input";
import type { RawNote } from "../music/types";

/** 너무 짧은 음(잡음·실수 터치)은 버림 */
const MIN_NOTE_SEC = 0.03;

/**
 * MIDI note-on/off 이벤트 → RawNote[] (단선율).
 * - 시간은 이벤트와 같은 기준(ms, performance.now 계열). startTime = 녹음 시작(1마디 1박) 시각, endTime = 녹음 정지 시각.
 * - 이미 누른 음이 있는데 새 note-on 이 오면 그 순간 이전 음을 끝냄(legato).
 * - 정지 시점까지 눌린 음은 endTime 에서 끝냄. 서스테인 페달은 길이에 반영하지 않음.
 * - 시작 전(카운트인)에 누른 음은 0초로 잘라 쓰고, 전부 시작 전에 끝난 음은 버림.
 */
export function midiEventsToRawNotes(events: MidiEvent[], startTime: number, endTime?: number): RawNote[] {
  const out: RawNote[] = [];
  let held: { midi: number; start: number } | null = null;
  const close = (end: number) => {
    if (!held) return;
    const startSec = Math.max(0, (held.start - startTime) / 1000);
    const endSec = (end - startTime) / 1000;
    if (endSec - startSec >= MIN_NOTE_SEC) out.push({ midi: held.midi, startSec, endSec, meanCents: 0 });
    held = null;
  };
  const sorted = events.filter((e) => e.type !== "pedal").sort((a, b) => a.time - b.time);
  for (const e of sorted) {
    if (endTime !== undefined && e.time > endTime) break;
    if (e.type === "on") {
      close(e.time);
      held = { midi: e.midi, start: e.time };
    } else if (e.type === "off" && held && held.midi === e.midi) {
      close(e.time);
    }
  }
  if (held) close(endTime ?? (held as { start: number }).start);
  return out;
}

export interface MetronomeSessionOptions {
  bpm: number;
  beatsPerMeasure: number;
  countInMeasures: number;
  metronome: boolean;
  manualLatencyMs?: number;
  /** 현재 박(카운트인 중에는 음수) */
  onBeat?: (beat: number) => void;
}

export interface MetronomeSession {
  /** 녹음 시작(1마디 1박, 들리는 클릭 기준)의 performance.now() 시각(ms) */
  startPerf: number;
  stop: () => void;
}

/** 마이크 없이 카운트인 + 메트로놈만 돌리는 세션 (MIDI 건반 녹음용). 제스처 핸들러 안에서 동기 호출. */
export function startMetronomeSession(opts: MetronomeSessionOptions): MetronomeSession {
  const ctx = getAudioContext();
  const outLatency = outputLatencySec({ outputLatency: ctx.outputLatency, baseLatency: ctx.baseLatency });
  const spb = 60 / opts.bpm;
  const countInBeats = opts.countInMeasures * opts.beatsPerMeasure;
  const t0 = ctx.currentTime + 0.15;
  const recordStart = t0 + countInBeats * spb;
  // 사용자는 "들리는" 클릭에 맞춰 치므로 출력 지연 + 수동 보정만큼 기준을 뒤로 민다
  const startPerf = performance.now() + (recordStart - ctx.currentTime + outLatency + (opts.manualLatencyMs ?? 0) / 1000) * 1000;

  let nextBeat = 0;
  const scheduler = setInterval(() => {
    while (t0 + nextBeat * spb < ctx.currentTime + 0.1) {
      const isCountIn = nextBeat < countInBeats;
      if (isCountIn || opts.metronome) playClick(ctx, t0 + nextBeat * spb, nextBeat % opts.beatsPerMeasure === 0);
      nextBeat++;
    }
  }, 25);

  let lastBeat = -Infinity;
  let raf = 0;
  const tick = () => {
    const heard = ctx.currentTime - outLatency;
    const beat = Math.floor((heard - recordStart) / spb);
    if (beat !== lastBeat && heard >= t0) {
      lastBeat = beat;
      opts.onBeat?.(beat);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    startPerf,
    stop: () => {
      cancelAnimationFrame(raf);
      clearInterval(scheduler);
    },
  };
}
