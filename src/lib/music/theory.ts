import { pitchClass, pitchClassName } from "./frequency";
import type { ChordEvent, KeyInfo, NoteEvent } from "./types";

/* ───────────── 조성 추정 (Krumhansl–Schmuckler) ───────────── */

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** 장조 으뜸음 피치 클래스 → 조표(fifths). F#/Gb 는 기타·찬양팀 관례상 F#(+6) */
const MAJOR_FIFTHS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };

export function fifthsFor(tonic: number, mode: "major" | "minor"): number {
  const relMajor = mode === "major" ? tonic : pitchClass(tonic + 3);
  return MAJOR_FIFTHS[pitchClass(relMajor)];
}

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function estimateKey(notes: NoteEvent[]): KeyInfo {
  const hist = new Array(12).fill(0);
  for (const n of notes) if (n.midi !== null) hist[pitchClass(n.midi)] += n.durationBeats;
  if (hist.every((v) => v === 0)) return { tonic: 0, mode: "major", fifths: 0 };
  // 짧은 허밍은 음 분포만으로 조가 모호함(예: 도·레·미·솔·라 → C? G?).
  // 대부분의 노래는 으뜸음으로 끝나므로 마지막 음에 가중치를 줍니다.
  const sounded = notes.filter((n) => n.midi !== null);
  const last = sounded[sounded.length - 1];
  if (last) hist[pitchClass(last.midi!)] += Math.max(3, last.durationBeats * 2);

  let best: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };
  let bestR = -Infinity;
  for (let t = 0; t < 12; t++) {
    for (const mode of ["major", "minor"] as const) {
      const profile = mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
      const rotated = profile.map((_, i) => profile[pitchClass(i - t)]);
      const r = correlation(hist, rotated) + (mode === "major" ? 0.02 : 0); // 동률이면 장조 우선
      if (r > bestR) {
        bestR = r;
        best = { tonic: t, mode, fifths: fifthsFor(t, mode) };
      }
    }
  }
  return best;
}

export function keyName(key: KeyInfo): string {
  return `${pitchClassName(key.tonic, key.fifths < 0)}${key.mode === "minor" ? "m" : ""}`;
}

/* ───────────── 코드 추천 (마디 단위, 규칙 기반) ───────────── */

interface ChordCandidate {
  rootOffset: number; // 으뜸음 기준 반음
  quality: "" | "m" | "dim";
  prior: number; // 대중음악에서의 출현 빈도 가중치
}

const MAJOR_CANDIDATES: ChordCandidate[] = [
  { rootOffset: 0, quality: "", prior: 0.35 }, // I
  { rootOffset: 5, quality: "", prior: 0.25 }, // IV
  { rootOffset: 7, quality: "", prior: 0.25 }, // V
  { rootOffset: 9, quality: "m", prior: 0.15 }, // vi
  { rootOffset: 2, quality: "m", prior: 0.1 }, // ii
  { rootOffset: 4, quality: "m", prior: 0.05 }, // iii
];

const MINOR_CANDIDATES: ChordCandidate[] = [
  { rootOffset: 0, quality: "m", prior: 0.35 }, // i
  { rootOffset: 5, quality: "m", prior: 0.2 }, // iv
  { rootOffset: 7, quality: "", prior: 0.2 }, // V (화성단음계)
  { rootOffset: 8, quality: "", prior: 0.15 }, // VI
  { rootOffset: 3, quality: "", prior: 0.1 }, // III
  { rootOffset: 10, quality: "", prior: 0.1 }, // VII
];

function chordTones(root: number, quality: ChordCandidate["quality"]): number[] {
  const third = quality === "" ? 4 : 3;
  const fifth = quality === "dim" ? 6 : 7;
  return [root, pitchClass(root + third), pitchClass(root + fifth)];
}

/**
 * 마디별로 멜로디와 가장 잘 맞는 다이아토닉 3화음을 고릅니다.
 * LLM이 아니라 규칙 기반이라 결과가 결정적이고 설명 가능합니다.
 */
export function suggestChords(notes: NoteEvent[], key: KeyInfo, beatsPerMeasure: number, measures: number): ChordEvent[] {
  const candidates = key.mode === "major" ? MAJOR_CANDIDATES : MINOR_CANDIDATES;
  const preferFlats = key.fifths < 0;
  const chords: ChordEvent[] = [];
  let prevSymbol: string | null = null;

  for (let m = 0; m < measures; m++) {
    const mStart = m * beatsPerMeasure;
    const mEnd = mStart + beatsPerMeasure;
    const inMeasure = notes.filter((n) => n.midi !== null && n.startBeat < mEnd && n.startBeat + n.durationBeats > mStart);

    let best: { symbol: string; score: number } | null = null;
    for (const c of candidates) {
      const root = pitchClass(key.tonic + c.rootOffset);
      const tones = chordTones(root, c.quality);
      let score = c.prior * beatsPerMeasure; // 사전 가중치는 마디 길이에 비례
      for (const n of inMeasure) {
        const overlap = Math.min(mEnd, n.startBeat + n.durationBeats) - Math.max(mStart, n.startBeat);
        const strong = n.startBeat === mStart || (n.startBeat - mStart) % 2 === 0 ? 1.3 : 1; // 강박 가중
        const pc = pitchClass(n.midi!);
        if (pc === root) score += overlap * strong * 1.05;
        else if (tones.includes(pc)) score += overlap * strong;
        else score -= overlap * 0.6;
      }
      // 첫 마디·마지막 마디는 으뜸화음으로 시작/종지하는 경우가 대부분
      if ((m === 0 || m === measures - 1) && c.rootOffset === 0) score += 0.8;
      const symbol = pitchClassName(root, preferFlats) + c.quality;
      if (!best || score > best.score) best = { symbol, score };
    }
    const symbol: string = inMeasure.length === 0 && prevSymbol ? prevSymbol : best!.symbol;
    chords.push({ startBeat: mStart, symbol });
    prevSymbol = symbol;
  }
  return chords;
}

/* ───────────── 전조 ───────────── */

export function transposeKey(key: KeyInfo, semitones: number): KeyInfo {
  const tonic = pitchClass(key.tonic + semitones);
  return { tonic, mode: key.mode, fifths: fifthsFor(tonic, key.mode) };
}

const ROOT_RE = /^([A-G])([#b]?)(.*)$/;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#m7/A" 같은 코드 기호를 반음 이동 (분수 코드의 베이스음도 함께) */
export function transposeChordSymbol(symbol: string, semitones: number, preferFlats: boolean): string {
  const [main, bass] = symbol.split("/");
  const shift = (s: string) => {
    const m = ROOT_RE.exec(s);
    if (!m) return s;
    const pc = LETTER_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    return pitchClassName(pc + semitones, preferFlats) + m[3];
  };
  return bass ? `${shift(main)}/${shift(bass)}` : shift(main);
}

/** 코드 기호 → 구성음 MIDI (반주 재생·피아노 왼손용, 기본 옥타브 3) */
export function chordToMidi(symbol: string, octave = 3): number[] {
  const m = ROOT_RE.exec(symbol.split("/")[0]);
  if (!m) return [];
  const root = LETTER_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  const rest = m[3];
  const minor = rest.startsWith("m") && !rest.startsWith("maj");
  const dim = rest.includes("dim");
  const base = (octave + 1) * 12 + pitchClass(root);
  const tones = [base, base + (minor || dim ? 3 : 4), base + (dim ? 6 : 7)];
  if (rest.includes("maj7")) tones.push(base + 11);
  else if (rest.includes("7")) tones.push(base + 10);
  return tones;
}
