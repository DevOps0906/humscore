import { midiToFreq } from "../frequency";
import type { NoteEvent, PitchFrame, Score } from "../types";

/** [midi|null, 박 수] 목록 -> 60fps 피치 프레임 (음 끝 40ms 숨, 약간의 음정 흔들림) */
export function hum(melody: [number | null, number][], bpm: number, detuneCents = 12): PitchFrame[] {
  const spb = 60 / bpm;
  const frames: PitchFrame[] = [];
  let t = 0;
  for (const [midi, beats] of melody) {
    const end = t + beats * spb;
    let k = 0;
    for (; t < end; t += 1 / 60, k++) {
      const gap = end - t < 0.04;
      const wobble = Math.sin(k / 3) * detuneCents;
      frames.push(
        midi === null || gap
          ? { time: t, freq: null, clarity: 0.2 }
          : { time: t, freq: midiToFreq(midi) * Math.pow(2, wobble / 1200), clarity: 0.97 },
      );
    }
    t = end;
  }
  return frames;
}

/** 일정 간격의 프레임 생성 */
export function frames(spec: (number | null)[], dt = 1 / 60, clarity = 0.97): PitchFrame[] {
  return spec.map((m, i) => ({
    time: i * dt,
    freq: m === null ? null : midiToFreq(m),
    clarity: m === null ? 0.1 : clarity,
  }));
}

export function makeScore(notes: NoteEvent[], over: Partial<Score> = {}): Score {
  return {
    id: "t",
    title: "T",
    bpm: 120,
    beatsPerMeasure: 4,
    beatUnit: 4,
    key: { tonic: 0, mode: "major", fifths: 0 },
    notes,
    chords: [],
    transpose: 0,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...over,
  };
}
