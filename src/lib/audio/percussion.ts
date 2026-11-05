import type { PlayNoteOptions } from "./piano-synth";

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: AudioContext) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate)), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** GM 드럼 음번호에 맞춰 피치 하강·노이즈·금속 배음을 조합한다. 전조하지 않는다. */
export function playDrumNote(ctx: AudioContext, midi: number, when: number, opts: PlayNoteOptions = {}): void {
  if (!Number.isInteger(midi) || midi < 35 || midi > 81 || !Number.isFinite(when)) return;
  const start = Math.max(0, when);
  const velocity = typeof opts.velocity === "number" && Number.isFinite(opts.velocity) ? Math.max(0, Math.min(1, opts.velocity)) : 0.8;
  const kick = midi === 35 || midi === 36;
  const snare = midi === 38 || midi === 40;
  const rim = midi === 37;
  const tom = [41, 43, 45, 47, 48, 50].includes(midi);
  const closedHat = midi === 42 || midi === 44;
  const openHat = midi === 46;
  const crash = midi === 49 || midi === 52 || midi === 55 || midi === 57;
  const ride = midi === 51 || midi === 53 || midi === 59;
  const triangle = midi === 80 || midi === 81;
  const duration = triangle ? (midi === 80 ? 0.09 : 2.4) : kick ? 0.45 : snare ? 0.22 : rim ? 0.07 : tom ? 0.4 : closedHat ? (midi === 44 ? 0.12 : 0.065) : openHat ? 0.5 : crash ? 1.35 : ride ? 0.85 : 0.18;
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const output = ctx.createGain();
  output.gain.setValueAtTime((kick ? 0.34 : crash ? 0.18 : triangle ? 0.2 : 0.24) * velocity, start);
  output.connect(opts.destination ?? ctx.destination);
  nodes.push(output);

  const tone = (frequency: number, gain: number, length: number, pitchDrop = 1, shape: OscillatorType = "sine") => {
    const oscillator = ctx.createOscillator();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.4, frequency * pitchDrop), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.min(ctx.sampleRate * 0.4, frequency), start + Math.min(0.12, length));
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(gain, start + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
    nodes.push(oscillator, envelope);
    sources.push(oscillator);
  };
  if (triangle) {
    // 금속 봉의 비정수 배음. 뮤트(80)는 짧게, 오픈(81)은 긴 잔향으로 구분한다.
    for (const [index, ratio] of [1, 1.47, 2.09, 2.56, 3.14].entries()) {
      tone(1650 * ratio, 0.48 / (index + 1), duration / (1 + index * 0.12));
    }
  }
  else if (kick) tone(48, 1, duration, 3.3);
  else if (tom) tone(75 + (midi - 41) * 10, 0.9, duration, 1.7);
  else if (snare) tone(180, 0.35, 0.12, 1.1, "triangle");
  else if (rim) { tone(1700, 0.42, 0.025, 1, "triangle"); tone(730, 0.32, 0.045); }
  else if (openHat || closedHat || crash || ride) {
    const base = ride ? 580 : crash ? 430 : 870;
    for (const [index, ratio] of [1, 1.342, 1.813, 2.476, 3.031].entries()) tone(base * ratio, 0.14 / (index + 1), duration, 1, "square");
  }
  if (!kick && !rim && !triangle) {
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = tom ? "lowpass" : "highpass";
    filter.frequency.setValueAtTime(Math.min(ctx.sampleRate * 0.4, snare ? 1400 : tom ? 1700 : closedHat || openHat ? 6500 : crash || ride ? 3200 : 2500 + midi * 15), start);
    filter.Q.value = 0.7;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(snare ? 0.9 : tom ? 0.15 : 0.6, start + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(output);
    source.start(start);
    source.stop(start + duration + 0.02);
    nodes.push(source, filter, envelope);
    sources.push(source);
  }
  let ended = 0;
  for (const source of sources) source.onended = () => {
    if (++ended === sources.length) for (const node of nodes) node.disconnect();
  };
}
