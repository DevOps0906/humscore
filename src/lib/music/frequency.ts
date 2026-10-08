/**
 * 피아노 88건반 주파수 테이블 (12평균율, A4 = 440Hz)
 *
 *   건반 번호 n (1~88):  f(n) = 440 × 2^((n − 49) / 12)
 *   MIDI 번호 m (21~108): f(m) = 440 × 2^((m − 69) / 12),  n = m − 20
 *
 * 앱 전체에서 Hz ↔ 음표 변환은 반드시 이 모듈을 거칩니다.
 */

export const A4_FREQ = 440;
export const A4_MIDI = 69;
export const PIANO_MIN_MIDI = 21; // A0, 27.5 Hz
export const PIANO_MAX_MIDI = 108; // C8, 4186.01 Hz

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export interface PianoKey {
  /** 1 ~ 88 */
  keyNumber: number;
  midi: number;
  /** 예: "A4", "C#5" */
  name: string;
  freq: number;
  isBlack: boolean;
}

export function midiToFreq(midi: number, a4 = A4_FREQ): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** 주파수 → 실수 MIDI 값 (예: 440 → 69.0, 445 → 69.196) */
export function freqToMidiFloat(freq: number, a4 = A4_FREQ): number {
  return A4_MIDI + 12 * Math.log2(freq / a4);
}

export function freqToNearestMidi(freq: number, a4 = A4_FREQ): number {
  return Math.round(freqToMidiFloat(freq, a4));
}

/** 가장 가까운 음 기준 오차(센트, -50 ~ +50). 음정 코칭 UI에 사용 */
export function centsOff(freq: number, a4 = A4_FREQ): number {
  const m = freqToMidiFloat(freq, a4);
  return (m - Math.round(m)) * 100;
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiToName(midi: number, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return `${names[pitchClass(midi)]}${octaveOf(midi)}`;
}

export function pitchClassName(pc: number, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pitchClass(pc)];
}

export const PIANO_KEYS: readonly PianoKey[] = Array.from({ length: 88 }, (_, i) => {
  const midi = PIANO_MIN_MIDI + i;
  return {
    keyNumber: i + 1,
    midi,
    name: midiToName(midi),
    freq: midiToFreq(midi),
    isBlack: SHARP_NAMES[pitchClass(midi)].includes("#"),
  };
});

/** 사람 목소리 검출 범위 (대략 C2 ~ C6). 이 밖의 값은 잡음으로 취급 */
export const VOICE_MIN_FREQ = 65;
export const VOICE_MAX_FREQ = 1100;

/** Hz → 음이름 문자열 (예: 440 → "A4", 261.63 → "C4") */
export function freqToNoteName(freq: number, preferFlats = false, a4 = A4_FREQ): string {
  return midiToName(freqToNearestMidi(freq, a4), preferFlats);
}
