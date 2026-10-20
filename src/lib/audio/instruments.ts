import { midiToFreq } from "../music/frequency";
import type { InstrumentId } from "../music/midi";
import { playPianoNote, type PlayNoteOptions } from "./piano-synth";

/**
 * Web Audio 합성 악기 9종 (샘플·음원 파일·외부 라이브러리 0개).
 * 피아노는 piano-synth 를 그대로 쓰고, 나머지는 오실레이터 + 필터 + 엔벨롭으로 음색을 만든다.
 * 모든 소스는 stop 시각이 지정되며, 끝나면 그래프를 disconnect 한다.
 */

export type { InstrumentId, PlayNoteOptions };

export const INSTRUMENT_ORDER: readonly InstrumentId[] = [
  "piano",
  "strings",
  "flute",
  "violin",
  "cello",
  "trumpet",
  "clarinet",
  "acousticGuitar",
  "choir",
];

export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  piano: "피아노",
  strings: "스트링 합주",
  flute: "플루트",
  violin: "바이올린",
  cello: "첼로",
  trumpet: "트럼펫",
  clarinet: "클라리넷",
  acousticGuitar: "어쿠스틱 기타",
  choir: "합창",
};

export function isInstrumentId(v: unknown): v is InstrumentId {
  return typeof v === "string" && (INSTRUMENT_ORDER as readonly string[]).includes(v);
}

/** 기본 서스테인(건반 미리듣기 등 duration 이 없을 때) */
const DEFAULT_HOLD = 0.8;

/** 악기별 출력 레벨 (velocity 1 기준 목표 피크 ≈ 0.3, 오프라인 렌더로 보정) */
const LEVEL: Record<Exclude<InstrumentId, "piano">, number> = {
  strings: 0.38,
  flute: 0.2,
  violin: 0.3,
  cello: 0.3,
  trumpet: 0.22,
  clarinet: 0.2,
  acousticGuitar: 0.22,
  choir: 0.36,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function safeVelocity(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, 0, 1) : 0.8;
}

function safeDuration(d: number | undefined): number | undefined {
  return typeof d === "number" && Number.isFinite(d) ? Math.max(0.05, d) : undefined;
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function getNoise(ctx: AudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

interface WaveSpec {
  /** "custom" 이면 harmonics(1차부터의 진폭) 로 PeriodicWave 생성 */
  type: OscillatorType | "custom";
  harmonics?: number[];
  cents: number;
  gain: number;
}

interface VoiceSpec {
  waves: WaveSpec[];
  /** 로우패스: 컷오프(Hz), 하한은 기본음 * minMult */
  lowpass?: { cutoff: number; q?: number; sweep?: { from: number; peak: number; peakAt: number; settle: number; settleAt: number } };
  /** 병렬 포먼트 밴드패스 (합창) */
  formants?: { f: number; q: number; gain: number }[];
  attack: number;
  release: number;
  level: number;
  vibrato?: { rate: number; cents: number; delay: number; ramp: number };
  /** 숨소리 노이즈 (플루트) */
  breath?: { gain: number; q: number; mult: number };
}

const SPECS: Record<Exclude<InstrumentId, "piano" | "acousticGuitar">, VoiceSpec> = {
  flute: {
    waves: [{ type: "custom", harmonics: [1, 0.12, 0.04], cents: 0, gain: 1 }],
    attack: 0.06,
    release: 0.09,
    level: LEVEL.flute,
    vibrato: { rate: 5, cents: 6, delay: 0.15, ramp: 0.4 },
    breath: { gain: 0.12, q: 0.9, mult: 3 },
  },
  clarinet: {
    // 홀수 배음 위주 (짝수는 거의 0)
    waves: [{ type: "custom", harmonics: [1, 0.01, 0.55, 0.01, 0.3, 0.005, 0.15, 0.003, 0.08], cents: 0, gain: 1 }],
    lowpass: { cutoff: 3200, q: 0.5 },
    attack: 0.04,
    release: 0.07,
    level: LEVEL.clarinet,
  },
  trumpet: {
    waves: [{ type: "sawtooth", cents: 0, gain: 1 }],
    lowpass: { cutoff: 2600, q: 1.2, sweep: { from: 900, peak: 3600, peakAt: 0.06, settle: 2200, settleAt: 0.25 } },
    attack: 0.03,
    release: 0.08,
    level: LEVEL.trumpet,
    vibrato: { rate: 5, cents: 5, delay: 0.5, ramp: 0.5 },
  },
  violin: {
    waves: [
      { type: "sawtooth", cents: -4, gain: 0.5 },
      { type: "sawtooth", cents: 4, gain: 0.5 },
    ],
    lowpass: { cutoff: 3000, q: 0.7 },
    attack: 0.08,
    release: 0.12,
    level: LEVEL.violin,
    vibrato: { rate: 5.5, cents: 14, delay: 0.1, ramp: 0.6 },
  },
  cello: {
    waves: [
      { type: "sawtooth", cents: -4, gain: 0.5 },
      { type: "sawtooth", cents: 4, gain: 0.5 },
    ],
    lowpass: { cutoff: 1200, q: 0.7 },
    attack: 0.1,
    release: 0.15,
    level: LEVEL.cello,
    vibrato: { rate: 5, cents: 9, delay: 0.15, ramp: 0.6 },
  },
  strings: {
    waves: [-15, -8, 0, 8, 15].map((c) => ({ type: "sawtooth" as const, cents: c, gain: 0.2 })),
    lowpass: { cutoff: 2200, q: 0.5 },
    attack: 0.15,
    release: 0.3,
    level: LEVEL.strings,
  },
  choir: {
    waves: [-12, -4, 5, 12].map((c) => ({ type: "sawtooth" as const, cents: c, gain: 1 })),
    // 모음 "아"
    formants: [
      { f: 800, q: 6, gain: 1 },
      { f: 1150, q: 7, gain: 0.6 },
      { f: 2900, q: 9, gain: 0.3 },
    ],
    attack: 0.2,
    release: 0.25,
    level: LEVEL.choir,
    vibrato: { rate: 5, cents: 8, delay: 0.2, ramp: 0.5 },
  },
};

function playSustained(
  ctx: AudioContext,
  spec: VoiceSpec,
  midi: number,
  when: number,
  opts: PlayNoteOptions,
): void {
  const freq = midiToFreq(midi);
  const nyq = ctx.sampleRate / 2;
  if (!Number.isFinite(freq) || freq <= 0 || freq >= nyq * 0.9 || !Number.isFinite(when)) return;
  const velocity = safeVelocity(opts.velocity);
  const dest = opts.destination ?? ctx.destination;
  const t0 = Math.max(0, when);
  const hold = Math.max(spec.attack + 0.02, safeDuration(opts.duration) ?? DEFAULT_HOLD);
  const tEnd = t0 + hold;
  const tStop = tEnd + spec.release + 0.02;
  const peak = spec.level * velocity;

  // 엔벨롭 (선형 어택 → 서스테인 → 선형 릴리즈)
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(peak, t0 + spec.attack);
  env.gain.setValueAtTime(peak, tEnd);
  env.gain.linearRampToValueAtTime(0, tEnd + spec.release);
  env.connect(dest);

  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [env];

  // 톤 입력단: 로우패스 또는 포먼트 병렬, 아니면 env 직결
  const mix = ctx.createGain();
  nodes.push(mix);
  if (spec.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = spec.lowpass.q ?? 0.7;
    const base = clamp(Math.max(spec.lowpass.cutoff, freq * 2.5), 100, nyq * 0.9);
    const sw = spec.lowpass.sweep;
    if (sw) {
      lp.frequency.setValueAtTime(clamp(sw.from, 100, nyq * 0.9), t0);
      lp.frequency.linearRampToValueAtTime(clamp(Math.max(sw.peak, freq * 3), 100, nyq * 0.9), t0 + sw.peakAt);
      lp.frequency.linearRampToValueAtTime(clamp(Math.max(sw.settle, freq * 2.5), 100, nyq * 0.9), t0 + sw.settleAt);
    } else {
      lp.frequency.setValueAtTime(base, t0);
    }
    mix.connect(lp);
    lp.connect(env);
    nodes.push(lp);
  } else if (spec.formants) {
    for (const fm of spec.formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(clamp(fm.f, 100, nyq * 0.9), t0);
      bp.Q.value = fm.q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(fm.gain, t0);
      mix.connect(bp);
      bp.connect(g);
      g.connect(env);
      nodes.push(bp, g);
    }
  } else {
    mix.connect(env);
  }

  // 비브라토 LFO (센트 단위로 osc.detune 에 연결)
  let lfoGain: GainNode | null = null;
  if (spec.vibrato) {
    const v = spec.vibrato;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(v.rate, t0);
    lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t0);
    lfoGain.gain.setValueAtTime(0, t0 + v.delay);
    lfoGain.gain.linearRampToValueAtTime(v.cents, t0 + v.delay + v.ramp);
    lfo.connect(lfoGain);
    lfo.start(t0);
    lfo.stop(tStop);
    sources.push(lfo);
    nodes.push(lfoGain);
  }

  for (const w of spec.waves) {
    const osc = ctx.createOscillator();
    if (w.type === "custom") {
      const h = w.harmonics ?? [1];
      const real = new Float32Array(h.length + 1);
      const imag = new Float32Array(h.length + 1);
      h.forEach((a, i) => {
        imag[i + 1] = a;
      });
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    } else {
      osc.type = w.type;
    }
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.setValueAtTime(w.cents, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(w.gain, t0);
    osc.connect(g);
    g.connect(mix);
    if (lfoGain) lfoGain.connect(osc.detune);
    osc.start(t0);
    osc.stop(tStop);
    sources.push(osc);
    nodes.push(g);
  }

  // 숨소리: 어택에 강하고 이후 약하게 유지
  if (spec.breath) {
    const b = spec.breath;
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(clamp(freq * b.mult, 500, nyq * 0.9), t0);
    bp.Q.value = b.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(b.gain, t0 + spec.attack * 0.6);
    g.gain.linearRampToValueAtTime(b.gain * 0.25, t0 + spec.attack + 0.15);
    src.connect(bp);
    bp.connect(g);
    g.connect(env);
    src.start(t0);
    src.stop(tStop);
    sources.push(src);
    nodes.push(bp, g);
  }

  // 정리: 가장 마지막에 끝나는 소스가 끝나면 그래프 해제
  const last = sources[sources.length - 1];
  last.onended = () => {
    for (const n of nodes) n.disconnect();
  };
}

/** 어쿠스틱 기타: 배음 1~8 가산합성 + 피크 노이즈, 고차 배음일수록 빠른 감쇠 */
function playGuitar(ctx: AudioContext, midi: number, when: number, opts: PlayNoteOptions): void {
  const freq = midiToFreq(midi);
  const nyq = ctx.sampleRate / 2;
  if (!Number.isFinite(freq) || freq <= 0 || freq >= nyq * 0.9 || !Number.isFinite(when)) return;
  const velocity = safeVelocity(opts.velocity);
  const dest = opts.destination ?? ctx.destination;
  const t0 = Math.max(0, when);
  const dur = safeDuration(opts.duration);
  const baseDecay = clamp(2.5 - (midi - 40) / 44, 1.5, 2.5); // 저음일수록 길게
  const MUTE = 0.25;
  const total = dur !== undefined ? Math.min(baseDecay, dur + MUTE) : baseDecay;
  const tStop = t0 + total + 0.02;

  const master = ctx.createGain();
  master.gain.setValueAtTime(LEVEL.acousticGuitar * velocity, t0);
  if (dur !== undefined && dur + MUTE < baseDecay) {
    master.gain.setValueAtTime(LEVEL.acousticGuitar * velocity, t0 + dur);
    master.gain.linearRampToValueAtTime(0, t0 + dur + MUTE);
  }
  master.connect(dest);

  const nodes: AudioNode[] = [master];
  let last: AudioScheduledSourceNode | null = null;
  for (let n = 1; n <= 8; n++) {
    const f = freq * n;
    if (f >= nyq * 0.95) break;
    const decay = Math.max(0.08, (baseDecay * 0.9) / (1 + 0.7 * (n - 1)));
    const amp = 1 / Math.pow(n, 1.15);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(amp * 0.002, t0 + decay);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(tStop);
    nodes.push(g);
    last = osc;
  }

  // 피크 노이즈
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(clamp(freq * 4, 800, nyq * 0.9), t0);
  bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.linearRampToValueAtTime(0.18, t0 + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(master);
  src.start(t0);
  src.stop(t0 + 0.06);
  nodes.push(bp, ng);

  const end = last ?? src;
  end.onended = () => {
    for (const n of nodes) n.disconnect();
  };
}

/**
 * 선택한 악기로 한 음을 재생. piano 는 기존 playPianoNote.
 * 지속음 악기는 duration 동안 서스테인 후 릴리즈(없으면 0.8초).
 */
export function playInstrumentNote(
  ctx: AudioContext,
  instrument: InstrumentId,
  midi: number,
  when: number,
  opts: PlayNoteOptions = {},
): void {
  switch (instrument) {
    case "piano":
      playPianoNote(ctx, midi, when, opts);
      return;
    case "acousticGuitar":
      playGuitar(ctx, midi, when, opts);
      return;
    default: {
      const spec = SPECS[instrument];
      if (!spec) {
        playPianoNote(ctx, midi, when, opts);
        return;
      }
      playSustained(ctx, spec, midi, when, opts);
    }
  }
}
