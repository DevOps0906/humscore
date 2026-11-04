import { isValidChordSymbol, scoreMeasureCount } from "./edit";
import { pitchClassName } from "./frequency";
import { buildProgression } from "./progressions";
import { chordToMidi } from "./theory";
import type { ChordEvent, NoteEvent, Score } from "./types";

export type MelodyStyle = "balanced" | "lyrical" | "rhythmic";
export type ReharmStyle = "gentle" | "jazz" | "color";

export interface ComposeOptions {
  measures: number;
  progressionId: string;
  style: MelodyStyle;
  seed: number;
  useExistingChords?: boolean;
}

const EPS = 1e-6;
const pc = (n: number) => ((n % 12) + 12) % 12;
const scaleOf = (score: Score) => (score.key.mode === "minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]).map((n) => pc(n + score.key.tonic));

function assertMeter(score: Score) {
  if (!Number.isInteger(score.beatsPerMeasure) || score.beatsPerMeasure < 1 || score.beatsPerMeasure > 32) {
    throw new Error("마디 길이는 1~32박이어야 합니다.");
  }
}

function randomOf(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function activeChord(chords: ChordEvent[], beat: number): ChordEvent {
  let active = chords[0];
  for (const chord of chords) {
    if (chord.startBeat > beat + EPS) break;
    active = chord;
  }
  return active;
}

function compositionChords(score: Score, options: ComposeOptions): ChordEvent[] {
  const total = options.measures * score.beatsPerMeasure;
  if (!options.useExistingChords) {
    const chords = buildProgression(options.progressionId, score.key, options.measures, score.beatsPerMeasure);
    if (!chords.length) throw new Error("알 수 없는 코드 진행입니다.");
    return chords;
  }
  if (!score.chords.length) throw new Error("현재 악보에 코드가 없습니다. 코드 진행을 먼저 선택해 주세요.");
  const unique = new Map<number, ChordEvent>();
  for (const chord of score.chords) {
    if (!Number.isFinite(chord.startBeat) || chord.startBeat < 0 || !isValidChordSymbol(chord.symbol)) {
      throw new Error("현재 코드의 위치나 코드 기호가 올바르지 않습니다.");
    }
    if (Math.abs(chord.startBeat * 4 - Math.round(chord.startBeat * 4)) > EPS) {
      throw new Error("코드 위치는 16분음표 단위여야 합니다.");
    }
    unique.set(chord.startBeat, { ...chord });
  }
  const pattern = [...unique.values()].sort((a, b) => a.startBeat - b.startBeat);
  // 첫 코드가 마디 중간에 있으면 같은 코드로 선행 구간도 채운다.
  if (pattern[0].startBeat > 0) pattern.unshift({ startBeat: 0, symbol: pattern[0].symbol });
  // 마지막 코드 이후의 유지 구간도 현재 진행의 일부이므로 원곡 전체 마디를 주기로 삼는다.
  const period = scoreMeasureCount(score) * score.beatsPerMeasure;
  const out: ChordEvent[] = [];
  for (let cycle = 0; cycle * period < total; cycle++) {
    for (const chord of pattern) {
      const startBeat = chord.startBeat + cycle * period;
      if (startBeat < total - EPS) out.push({ ...chord, startBeat });
    }
  }
  return out;
}

/** 코드 구성음·음계·짧은 동기 변주로 만드는 새 멜로디. 특정 곡의 선율 데이터는 사용하지 않는다. */
export function composeMelody(score: Score, options: ComposeOptions): { notes: NoteEvent[]; chords: ChordEvent[] } {
  assertMeter(score);
  if (!Number.isInteger(options.measures) || options.measures < 1 || options.measures > 32) throw new Error("작곡 마디 수는 1~32마디여야 합니다.");
  if (!Number.isFinite(options.seed)) throw new Error("변주 번호가 올바르지 않습니다.");
  if (!["balanced", "lyrical", "rhythmic"].includes(options.style)) throw new Error("알 수 없는 멜로디 스타일입니다.");
  const random = randomOf(options.seed);
  const chords = compositionChords(score, options);
  const scale = scaleOf(score);
  const rhythms: Record<MelodyStyle, number[][]> = {
    balanced: [[1, 0.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1]],
    lyrical: [[2, 1, 1], [1.5, 0.5, 2]],
    rhythmic: [[0.5, 0.5, 1, 0.5, 0.5, 1], [0.75, 0.25, 0.5, 0.5, 1, 1]],
  };
  const rhythm = rhythms[options.style][Math.floor(random() * rhythms[options.style].length)];
  const motif = Array.from({ length: 4 }, () => Math.floor(random() * 5) - 2);
  const notes: NoteEvent[] = [];
  let previous = 67 + score.key.tonic % 5;
  const total = options.measures * score.beatsPerMeasure;
  for (let measure = 0; measure < options.measures; measure++) {
    const measureStart = measure * score.beatsPerMeasure;
    const measureEnd = measureStart + score.beatsPerMeasure;
    let beat = measureStart;
    let step = 0;
    while (beat < measureEnd - EPS) {
      const chord = activeChord(chords, beat);
      const tones = chordToMidi(chord.symbol).map(pc);
      const local = beat - measureStart;
      const strong = local < EPS || (score.meter === "6/8" ? Math.abs(local - 1.5) < EPS : Math.abs(local % 2) < EPS);
      const chordChange = Math.abs(chord.startBeat - beat) < EPS;
      const candidates = Array.from({ length: 25 }, (_, i) => 60 + i).filter((n) => (strong || chordChange ? tones : scale).includes(pc(n)));
      // 2마디 동기를 반복하되 후반구에는 음역·방향을 조금 바꾼다.
      const target = Math.max(62, Math.min(79, previous + motif[step % motif.length] + (measure % 4 === 2 ? 2 : 0)));
      const ranked = candidates.map((midi) => ({ midi, cost: Math.abs(midi - target) + Math.abs(midi - previous) * 0.3 + random() * 2.5 })).sort((a, b) => a.cost - b.cost);
      let midi = ranked[0].midi;
      const nextChord = chords.find((c) => c.startBeat > beat + EPS)?.startBeat ?? total;
      // 복합박의 두 번째 강박과 코드 변경 지점에도 새 음표를 시작한다.
      const nextStrong = score.meter === "6/8" && local < 1.5 - EPS ? measureStart + 1.5 : measureEnd;
      let durationBeats = Math.min(rhythm[step % rhythm.length], measureEnd - beat, nextChord - beat, nextStrong - beat);
      if (measure === options.measures - 1 && measureEnd - beat <= 1 + EPS) {
        const ending = Array.from({ length: 25 }, (_, i) => 60 + i).filter((n) => tones.includes(pc(n)));
        midi = ending.sort((a, b) => Math.abs(a - previous) - Math.abs(b - previous))[0];
        durationBeats = Math.min(durationBeats, measureEnd - beat);
      }
      notes.push({ midi, startBeat: beat, durationBeats });
      previous = midi;
      beat += durationBeats;
      step++;
    }
  }
  return { notes, chords };
}

interface Candidate { symbol: string; root: number; tones: number[]; color: boolean }

/** 원본 멜로디·가사를 건드리지 않고 마디별 대리 코드만 제안한다. */
export function reharmonize(score: Score, style: ReharmStyle): ChordEvent[] {
  assertMeter(score);
  if (!["gentle", "jazz", "color"].includes(style)) throw new Error("알 수 없는 리하모니제이션 스타일입니다.");
  const sounding = score.notes.filter((n) => n.midi !== null && n.durationBeats > 0);
  if (!sounding.length) throw new Error("리하모니제이션할 멜로디가 없습니다.");
  if (sounding.some((n) => !Number.isFinite(n.startBeat) || n.startBeat < 0 || !Number.isFinite(n.durationBeats) || !Number.isInteger(n.midi))) {
    throw new Error("멜로디의 음높이나 박 위치가 올바르지 않습니다.");
  }
  const end = sounding.reduce((max, n) => Math.max(max, n.startBeat + n.durationBeats), 0);
  const count = Math.ceil(end / score.beatsPerMeasure - EPS);
  if (count > 1500) throw new Error("리하모니제이션은 1500마디까지 지원합니다.");
  const scale = scaleOf(score);
  const minor = score.key.mode === "minor";
  const qualities = minor ? ["m", "dim", "", "m", "m", "", ""] : ["", "m", "m", "", "", "m", "dim"];
  const sevenths = minor ? ["m7", "dim", "maj7", "m7", "7", "maj7", "7"] : ["maj7", "m7", "m7", "maj7", "7", "m7", "dim"];
  const pool: Candidate[] = [];
  const add = (root: number, suffix: string, color: boolean) => {
    const symbol = pitchClassName(root, score.key.fifths < 0) + suffix;
    if (!pool.some((c) => c.symbol === symbol)) pool.push({ symbol, root: pc(root), tones: chordToMidi(symbol).map(pc), color });
  };
  scale.forEach((root, i) => add(root, style === "gentle" ? qualities[i] : sevenths[i], false));
  if (style === "color") {
    // 차용 iv·♭VI, 트라이톤 대리 ♭II7. 실제 멜로디 적합도가 낮으면 선택하지 않는다.
    add(score.key.tonic + 5, minor ? "" : "m7", true);
    add(score.key.tonic + 8, "maj7", true);
    add(score.key.tonic + 1, "7", true);
  }
  const out: ChordEvent[] = [];
  let previousRoot = score.key.tonic;
  for (let measure = 0; measure < count; measure++) {
    const start = measure * score.beatsPerMeasure;
    const stop = start + score.beatsPerMeasure;
    const evidence = sounding.filter((n) => n.startBeat < stop - EPS && n.startBeat + n.durationBeats > start + EPS);
    const original = score.chords.length ? activeChord([...score.chords].sort((a, b) => a.startBeat - b.startBeat), start)?.symbol : undefined;
    const ranked = pool.map((candidate) => {
      let cost = 0;
      for (const note of evidence) {
        const overlap = Math.min(stop, note.startBeat + note.durationBeats) - Math.max(start, note.startBeat);
        const weight = note.startBeat <= start + EPS ? 2 : 1;
        const p = pc(note.midi!);
        cost += overlap * weight * (candidate.tones.includes(p) ? -3 : 4);
      }
      const rootDistance = Math.min(pc(candidate.root - previousRoot), pc(previousRoot - candidate.root));
      cost += rootDistance * 0.12;
      if (original === candidate.symbol) cost += 0.9; // 대리화성을 우선하되 음정 적합도를 뒤집지 않는다.
      if (style === "color" && candidate.color) cost -= 0.8;
      if (measure === count - 1 && candidate.root === score.key.tonic) cost -= 0.7;
      return { candidate, cost };
    }).sort((a, b) => a.cost - b.cost);
    const chosen = ranked[0].candidate;
    out.push({ startBeat: start, symbol: chosen.symbol });
    previousRoot = chosen.root;
  }
  return out;
}
