import type { KeyInfo } from "./types";

/**
 * 조성 인식 이명동음(enharmonic) 철자, 임시표 추적, 음정 이름.
 * 모든 철자는 5도권 위치(C=0, G=1, F=-1, F#=6, Bb=-2 ...)로 계산합니다.
 */

export type Step = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export interface SpelledPitch {
  step: Step;
  /** -2(겹내림) ~ +2(겹올림). spellPitch 는 -1..+1 만 반환 */
  alter: number;
  octave: number;
}

export interface SpellContext {
  /** 다음에 나오는 (쉼표 아닌) 음의 MIDI. 없으면 undefined/null */
  next?: number | null;
}

type KeyLike = Pick<KeyInfo, "fifths" | "mode">;

const LINE_LETTERS: Step[] = ["F", "C", "G", "D", "A", "E", "B"];
const STEPS: Step[] = ["C", "D", "E", "F", "G", "A", "B"];
const STEP_PC = [0, 2, 4, 5, 7, 9, 11];
const STEP_INDEX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const mod = (n: number, m: number) => ((n % m) + m) % m;

function lineToSpell(p: number): { step: Step; alter: number } {
  return { step: LINE_LETTERS[mod(p + 1, 7)], alter: Math.floor((p + 1) / 7) };
}
const linePc = (p: number) => mod(p * 7, 12);

function withOctave(midi: number, s: { step: Step; alter: number }): SpelledPitch {
  const natural = midi - s.alter;
  return { step: s.step, alter: s.alter, octave: Math.floor(natural / 12) - 1 };
}

/** 장조/화성단음계 음계음의 5도권 위치 집합 */
function diatonicLine(key: KeyLike): number[] {
  const set: number[] = [];
  for (let p = key.fifths - 1; p <= key.fifths + 5; p++) set.push(p);
  // 화성단음계 올린 7음 (겹올림이 되는 조에서는 생략)
  if (key.mode === "minor" && Math.floor((key.fifths + 9) / 7) <= 1) set.push(key.fifths + 3 + 5);
  return set;
}

/**
 * MIDI 번호의 악보상 철자.
 * - 조의 음계음(장조·자연/화성단음계)은 그 음계의 철자 (F#장조의 E#, Gb장조의 Cb, a단조의 G#)
 * - 음계 밖 음: 흰건반은 제자리음, 검은건반은 다음 음이 위면 올림(#), 아래면 내림(b),
 *   다음 음이 없거나 같으면 조 방향(#조 #, b조 b, C·Am 은 C# Eb F# Ab Bb)
 */
export function spellPitch(midi: number, key: KeyLike, context: SpellContext = {}): SpelledPitch {
  const pc = mod(midi, 12);
  for (const p of diatonicLine(key)) if (linePc(p) === pc) return withOctave(midi, lineToSpell(p));

  const white = STEP_PC.indexOf(pc);
  if (white >= 0) return withOctave(midi, { step: STEPS[white], alter: 0 });

  let sharpP = 0;
  let flatP = 0;
  for (let p = 6; p <= 12; p++) if (linePc(p) === pc) sharpP = p; // alter +1
  for (let p = -8; p <= -2; p++) if (linePc(p) === pc) flatP = p; // alter -1
  let useSharp: boolean;
  const next = context.next;
  if (next !== undefined && next !== null && next !== midi) useSharp = next > midi;
  else if (key.fifths > 0) useSharp = true;
  else if (key.fifths < 0) useSharp = false;
  else useSharp = pc === 1 || pc === 6;
  return withOctave(midi, lineToSpell(useSharp ? sharpP : flatP));
}

/** 조표가 적용하는 음이름별 변화량 (예: fifths=2 -> F:+1, C:+1) */
export function keySignatureAlters(fifths: number): Partial<Record<Step, number>> {
  const out: Partial<Record<Step, number>> = {};
  const sharps: Step[] = ["F", "C", "G", "D", "A", "E", "B"];
  const flats: Step[] = ["B", "E", "A", "D", "G", "C", "F"];
  if (fifths > 0) for (let i = 0; i < Math.min(7, fifths); i++) out[sharps[i]] = 1;
  if (fifths < 0) for (let i = 0; i < Math.min(7, -fifths); i++) out[flats[i]] = -1;
  return out;
}

export type AccidentalName = "sharp" | "flat" | "natural" | "double-sharp" | "flat-flat";

function accidentalName(alter: number): AccidentalName {
  if (alter === 0) return "natural";
  if (alter === 1) return "sharp";
  if (alter === -1) return "flat";
  return alter > 0 ? "double-sharp" : "flat-flat";
}

/**
 * 마디 안 임시표 상태 추적기(보표·성부마다 하나씩).
 * 조표 + 같은 마디에서 같은 음이름·옥타브에 이미 표시된 임시표와 비교해 필요할 때만 이름을 돌려줌.
 */
export class AccidentalTracker {
  private sig: Partial<Record<Step, number>>;
  private shown = new Map<string, number>();
  constructor(fifths: number) {
    this.sig = keySignatureAlters(fifths);
  }
  /** 마디가 바뀔 때 호출 */
  reset(): void {
    this.shown.clear();
  }
  /** 음을 처리하고 표시해야 할 임시표(없으면 null)를 반환 */
  next(p: SpelledPitch): AccidentalName | null {
    const k = `${p.step}${p.octave}`;
    const current = this.shown.has(k) ? this.shown.get(k)! : (this.sig[p.step] ?? 0);
    if (current === p.alter) return null;
    this.shown.set(k, p.alter);
    return accidentalName(p.alter);
  }
}

// ---------------------------------------------------------------- 음정 이름

/** 반음 수(0..11) -> 도수 오프셋(0 기반): 1도=0 ... 7도=6. 6반음은 증4도 */
const DEGREE_OF_SEMITONE = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
const SIMPLE_SEMIS = [0, 0, 2, 4, 5, 7, 9, 11, 12]; // 1-based 도수의 완전/장 기준 반음 수

const diatonicIndex = (p: SpelledPitch) => p.octave * 7 + STEP_INDEX[p.step];
const naturalMidi = (step: Step, octave: number) => (octave + 1) * 12 + STEP_PC[STEP_INDEX[step]];

/**
 * 두 음의 음정 이름(한국어). 예: "완전5도", "단3도", "증4도", "장10도".
 * 철자는 key 가 있으면 그 조에서의 철자(spellPitch), 없으면 아래 음 기준 관용 철자(6반음 = 증4도).
 */
export function intervalName(lowerMidi: number, upperMidi: number, key?: KeyLike): string {
  let lo = lowerMidi;
  let up = upperMidi;
  if (lo > up) [lo, up] = [up, lo];
  const semis = up - lo;

  let low: SpelledPitch;
  let high: SpelledPitch;
  if (key) {
    low = spellPitch(lo, key, { next: up });
    high = spellPitch(up, key);
  } else {
    low = spellPitch(lo, { fifths: 0, mode: "major" }, { next: up });
    const offset = Math.floor(semis / 12) * 7 + DEGREE_OF_SEMITONE[semis % 12];
    const d = diatonicIndex(low) + offset;
    const step = STEPS[mod(d, 7)];
    const octave = Math.floor(d / 7);
    high = { step, octave, alter: up - naturalMidi(step, octave) };
  }

  const dn = diatonicIndex(high) - diatonicIndex(low) + 1;
  let simple: number;
  let octaves: number;
  if (dn > 1 && (dn - 1) % 7 === 0) {
    simple = 8;
    octaves = (dn - 1) / 7 - 1;
  } else {
    simple = ((dn - 1) % 7) + 1;
    octaves = Math.floor((dn - 1) / 7);
  }
  const diff = semis - 12 * octaves - SIMPLE_SEMIS[simple];
  const perfect = simple === 1 || simple === 4 || simple === 5 || simple === 8;

  let quality: string;
  if (perfect) {
    quality = diff === 0 ? "완전" : diff > 0 ? (diff === 1 ? "증" : "겹증") : diff === -1 ? "감" : "겹감";
  } else if (diff === 0) quality = "장";
  else if (diff === -1) quality = "단";
  else if (diff > 0) quality = diff === 1 ? "증" : "겹증";
  else quality = diff === -2 ? "감" : "겹감";
  return `${quality}${dn}도`;
}
