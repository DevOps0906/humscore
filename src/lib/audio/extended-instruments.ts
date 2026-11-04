import { midiToFreq } from "../music/frequency";
import type { InstrumentId } from "../music/instrument-catalog";
import type { PlayNoteOptions } from "./piano-synth";

interface Patch {
  wave: OscillatorType;
  harmonics?: readonly number[];
  attack: number;
  release: number;
  level: number;
  cutoff: number;
  decay?: number;
  detune?: number;
  fm?: { ratio: number; depth: number; decay: number };
  tremolo?: { rate: number; depth: number };
  pattern?: readonly number[];
  rate?: number;
}

/** 음색마다 배음·FM 변조·필터·어택·감쇠를 별도로 둔다. 외부 음원은 사용하지 않는다. */
const PATCHES: Partial<Record<InstrumentId, Patch>> = {
  feltPiano: { wave: "sine", harmonics: [1, 0.2, 0.06], attack: 0.012, release: 0.2, level: 0.28, cutoff: 1800, decay: 2.2 },
  uprightPiano: { wave: "triangle", harmonics: [1, 0.45, 0.21, 0.11], attack: 0.005, release: 0.13, level: 0.23, cutoff: 4200, decay: 1.65, detune: 2 },
  epRhodes: { wave: "sine", attack: 0.007, release: 0.25, level: 0.27, cutoff: 3500, decay: 2.3, fm: { ratio: 1, depth: 1.1, decay: 0.75 } },
  epBright: { wave: "sine", attack: 0.003, release: 0.2, level: 0.24, cutoff: 6400, decay: 1.7, fm: { ratio: 2, depth: 2.5, decay: 0.45 } },
  epBell: { wave: "sine", attack: 0.004, release: 0.45, level: 0.25, cutoff: 7600, decay: 2.6, fm: { ratio: 3.5, depth: 1.5, decay: 1.2 } },
  epSuitcase: { wave: "sine", attack: 0.01, release: 0.3, level: 0.27, cutoff: 2900, decay: 2.5, fm: { ratio: 1, depth: 0.8, decay: 0.9 }, tremolo: { rate: 4.7, depth: 0.2 } },
  epStage: { wave: "triangle", attack: 0.004, release: 0.16, level: 0.23, cutoff: 4400, decay: 1.45, fm: { ratio: 1, depth: 0.6, decay: 0.4 } },
  epTine: { wave: "sine", attack: 0.002, release: 0.35, level: 0.25, cutoff: 5800, decay: 2.05, fm: { ratio: 7, depth: 0.7, decay: 0.22 } },
  epWurli: { wave: "triangle", harmonics: [1, 0.3, 0.25, 0.14], attack: 0.005, release: 0.14, level: 0.22, cutoff: 3200, decay: 1.6, tremolo: { rate: 5.2, depth: 0.16 } },
  epCP: { wave: "triangle", harmonics: [1, 0.55, 0.17, 0.08], attack: 0.003, release: 0.11, level: 0.22, cutoff: 5100, decay: 1.35, detune: 1.5 },
  epFM: { wave: "sine", attack: 0.002, release: 0.4, level: 0.25, cutoff: 9000, decay: 2.4, fm: { ratio: 2.01, depth: 4, decay: 0.65 } },
  epChorus: { wave: "sine", attack: 0.008, release: 0.5, level: 0.24, cutoff: 4600, decay: 2.7, detune: 8, fm: { ratio: 1, depth: 1.2, decay: 0.8 } },
  warmPad: { wave: "triangle", attack: 0.35, release: 0.8, level: 0.22, cutoff: 1300, detune: 5 },
  ambientPad: { wave: "sine", harmonics: [1, 0.25, 0.08], attack: 0.6, release: 1.2, level: 0.24, cutoff: 2200, detune: 9 },
  shimmerPad: { wave: "sine", harmonics: [1, 0.08, 0.1, 0.28, 0, 0.14, 0, 0.1], attack: 0.5, release: 1.35, level: 0.2, cutoff: 8200, detune: 6 },
  analogPad: { wave: "sawtooth", attack: 0.28, release: 0.65, level: 0.18, cutoff: 2100, detune: 11 },
  orchestralPad: { wave: "sawtooth", harmonics: [1, 0.45, 0.22, 0.15], attack: 0.42, release: 0.9, level: 0.21, cutoff: 3200, detune: 7 },
  b3Organ: { wave: "sine", harmonics: [1, 0.7, 0.45, 0.55, 0.2, 0.15, 0.1, 0.1], attack: 0.004, release: 0.06, level: 0.2, cutoff: 6900, tremolo: { rate: 6, depth: 0.1 } },
  churchOrgan: { wave: "sine", harmonics: [1, 0.55, 0.22, 0.42, 0.05, 0.15, 0, 0.2], attack: 0.045, release: 0.35, level: 0.24, cutoff: 9500, detune: 2 },
  synthPluck: { wave: "sawtooth", attack: 0.002, release: 0.08, level: 0.18, cutoff: 3900, decay: 0.48 },
  synthBell: { wave: "sine", attack: 0.002, release: 0.4, level: 0.24, cutoff: 11000, decay: 2.4, fm: { ratio: 2.76, depth: 2.2, decay: 1.5 } },
  synthLead: { wave: "sawtooth", attack: 0.012, release: 0.12, level: 0.17, cutoff: 6200, detune: 4 },
  synthArp: { wave: "square", attack: 0.002, release: 0.04, level: 0.14, cutoff: 3200, decay: 0.15, pattern: [0, 7, 12, 7], rate: 0.16 },
  synthBass: { wave: "sawtooth", harmonics: [1, 0.25, 0.12], attack: 0.006, release: 0.1, level: 0.25, cutoff: 900 },
  voxPad: { wave: "triangle", harmonics: [1, 0.06, 0.7, 0.12, 0.36], attack: 0.38, release: 0.85, level: 0.23, cutoff: 3000, detune: 4 },
  texturePad: { wave: "sine", harmonics: [1, 0.05, 0.12, 0.02, 0.15, 0.03, 0.1], attack: 0.7, release: 1.4, level: 0.24, cutoff: 4800, detune: 17, tremolo: { rate: 0.7, depth: 0.3 } },
  violinII: { wave: "sawtooth", attack: 0.105, release: 0.18, level: 0.2, cutoff: 2700, detune: 6 },
  viola: { wave: "sawtooth", attack: 0.12, release: 0.2, level: 0.22, cutoff: 2100, detune: 3 },
  doubleBass: { wave: "sawtooth", attack: 0.14, release: 0.22, level: 0.27, cutoff: 950, detune: 2 },
  piccolo: { wave: "sine", harmonics: [1, 0.3, 0.05], attack: 0.025, release: 0.06, level: 0.22, cutoff: 10000 },
  oboe: { wave: "square", harmonics: [1, 0.35, 0.7, 0.15, 0.35], attack: 0.035, release: 0.07, level: 0.2, cutoff: 4200 },
  englishHorn: { wave: "triangle", harmonics: [1, 0.15, 0.55, 0.12, 0.2], attack: 0.06, release: 0.1, level: 0.24, cutoff: 2300 },
  bassoon: { wave: "square", harmonics: [1, 0.1, 0.7, 0.04, 0.25], attack: 0.07, release: 0.11, level: 0.25, cutoff: 1700 },
  frenchHorn: { wave: "sawtooth", attack: 0.09, release: 0.14, level: 0.22, cutoff: 1800 },
  trombone: { wave: "sawtooth", attack: 0.05, release: 0.1, level: 0.23, cutoff: 3400 },
  bassTrombone: { wave: "sawtooth", attack: 0.065, release: 0.14, level: 0.25, cutoff: 1600 },
  tuba: { wave: "triangle", harmonics: [1, 0.4, 0.1], attack: 0.1, release: 0.17, level: 0.28, cutoff: 1050 },
  timpani: { wave: "sine", harmonics: [1, 0.55, 0.35, 0.12], attack: 0.003, release: 0.25, level: 0.24, cutoff: 2100, decay: 2.6 },
  timpaniRoll: { wave: "sine", harmonics: [1, 0.5, 0.24], attack: 0.003, release: 0.17, level: 0.08, cutoff: 2200, decay: 0.35, pattern: [0], rate: 0.065 },
  harp: { wave: "sine", harmonics: [1, 0.45, 0.2, 0.08], attack: 0.003, release: 0.3, level: 0.24, cutoff: 6500, decay: 2.25 },
  celesta: { wave: "sine", attack: 0.002, release: 0.35, level: 0.24, cutoff: 8000, decay: 2.1, fm: { ratio: 3, depth: 0.65, decay: 1.3 } },
  glockenspiel: { wave: "sine", attack: 0.001, release: 0.4, level: 0.25, cutoff: 12500, decay: 2.8, fm: { ratio: 2.756, depth: 1.1, decay: 2 } },
  xylophone: { wave: "sine", attack: 0.001, release: 0.07, level: 0.26, cutoff: 7000, decay: 0.4, fm: { ratio: 3, depth: 1.3, decay: 0.12 } },
  marimba: { wave: "sine", harmonics: [1, 0.03, 0, 0.34], attack: 0.003, release: 0.14, level: 0.28, cutoff: 2500, decay: 1.25 },
  vibraphone: { wave: "sine", attack: 0.003, release: 0.35, level: 0.26, cutoff: 6500, decay: 2.7, fm: { ratio: 3.99, depth: 0.3, decay: 1.6 }, tremolo: { rate: 5.5, depth: 0.28 } },
};

const finite = (value: number | undefined, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function playVoice(ctx: AudioContext, patch: Patch, midi: number, when: number, opts: PlayNoteOptions): void {
  const frequency = midiToFreq(midi);
  const nyquist = ctx.sampleRate / 2;
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= nyquist * 0.9 || !Number.isFinite(when)) return;
  const start = Math.max(0, when);
  const hold = Math.max(patch.attack + 0.02, finite(opts.duration, 0.8, 0.05, 60));
  const length = patch.decay ? Math.min(patch.decay, hold + patch.release) : hold + patch.release;
  const end = start + length;
  const stop = end + 0.02;
  const peak = patch.level * finite(opts.velocity, 0.8, 0, 1);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const output = ctx.createGain();
  nodes.push(output);
  output.gain.setValueAtTime(0.0001, start);
  output.gain.linearRampToValueAtTime(peak, start + patch.attack);
  if (patch.decay) output.gain.exponentialRampToValueAtTime(0.0001, end);
  else {
    output.gain.setValueAtTime(peak, start + hold);
    output.gain.linearRampToValueAtTime(0, end);
  }
  output.connect(opts.destination ?? ctx.destination);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(Math.min(nyquist * 0.9, Math.max(frequency * 2, patch.cutoff)), start);
  filter.connect(output);
  nodes.push(filter);
  const cents = patch.detune ? [-patch.detune, 0, patch.detune] : [0];
  for (const detune of cents) {
    const oscillator = ctx.createOscillator();
    nodes.push(oscillator);
    sources.push(oscillator);
    oscillator.type = patch.wave;
    if (patch.harmonics) {
      const real = new Float32Array(patch.harmonics.length + 1);
      const imaginary = new Float32Array(patch.harmonics.length + 1);
      patch.harmonics.forEach((amplitude, index) => { imaginary[index + 1] = frequency * (index + 1) < nyquist ? amplitude : 0; });
      oscillator.setPeriodicWave(ctx.createPeriodicWave(real, imaginary));
    }
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(detune, start);
    const mix = ctx.createGain();
    mix.gain.setValueAtTime(1 / cents.length, start);
    oscillator.connect(mix);
    mix.connect(filter);
    nodes.push(mix);
    if (patch.fm) {
      const modulator = ctx.createOscillator();
      modulator.frequency.setValueAtTime(Math.min(nyquist * 0.8, frequency * patch.fm.ratio), start);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(frequency * patch.fm.depth, start);
      depth.gain.exponentialRampToValueAtTime(0.0001, Math.min(end, start + patch.fm.decay));
      modulator.connect(depth);
      depth.connect(oscillator.frequency);
      modulator.start(start);
      modulator.stop(stop);
      nodes.push(modulator, depth);
      sources.push(modulator);
    }
    oscillator.start(start);
    oscillator.stop(stop);
  }
  if (patch.tremolo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(patch.tremolo.rate, start);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(peak * patch.tremolo.depth, start);
    lfo.connect(depth);
    depth.connect(output.gain);
    lfo.start(start);
    lfo.stop(stop);
    nodes.push(lfo, depth);
    sources.push(lfo);
  }
  let ended = 0;
  for (const source of sources) source.onended = () => {
    if (++ended === sources.length) for (const node of nodes) node.disconnect();
  };
}

/** 아르페지오는 한 음을 다른 이름으로 재생하지 않고 실제 간격의 연속 음으로 예약한다. */
export function playExtendedInstrumentNote(ctx: AudioContext, instrument: InstrumentId, midi: number, when: number, opts: PlayNoteOptions): boolean {
  const patch = PATCHES[instrument];
  if (!patch) return false;
  if (!patch.pattern) { playVoice(ctx, patch, midi, when, opts); return true; }
  const rate = patch.rate ?? 0.16;
  const duration = finite(opts.duration, 0.8, 0.05, 60);
  const count = Math.min(32, Math.ceil(duration / rate));
  for (let index = 0; index < count; index++) {
    const remaining = duration - index * rate;
    playVoice(ctx, patch, midi + patch.pattern[index % patch.pattern.length], when + index * rate, { ...opts, duration: Math.min(rate, remaining) });
  }
  return true;
}
