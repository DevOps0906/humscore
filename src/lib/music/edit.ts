import { newId } from "./pipeline";
import type { ChordEvent, KeyInfo, NoteEvent, Score } from "./types";

/** 입력 가능한 음가(박). 16분=0.25, 8분=0.5, 점8분=0.75, 4분=1, 점4분=1.5, 2분=2, 점2분=3, 온음표=4 */
export const STEP_DURATIONS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

const EPS = 1e-6;

/** startBeat 순으로 정렬한 뒤 0부터 빈틈없이 다시 이어 붙임 */
export function reflow(notes: NoteEvent[]): NoteEvent[] {
  const sorted = notes.map((n, i) => ({ n, i })).sort((a, b) => a.n.startBeat - b.n.startBeat || a.i - b.i);
  let t = 0;
  return sorted.map(({ n }) => {
    const out = { ...n, startBeat: t };
    t += n.durationBeats;
    return out;
  });
}

/** 끝에 음(또는 midi=null 쉼표) 추가 */
export function appendNote(notes: NoteEvent[], midi: number | null, durationBeats: number): NoteEvent[] {
  const end = notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  return [...notes.map((n) => ({ ...n })), { midi, startBeat: end, durationBeats }];
}

/** index 앞에 삽입 (index >= length 이면 끝에 추가) 후 reflow */
export function insertNote(notes: NoteEvent[], index: number, midi: number | null, durationBeats: number): NoteEvent[] {
  const base = reflow(notes);
  if (index >= base.length) return appendNote(base, midi, durationBeats);
  const i = Math.max(0, Math.floor(index));
  const next = [...base];
  next.splice(i, 0, { midi, startBeat: 0, durationBeats });
  return reflow(next.map((n, k) => ({ ...n, startBeat: k })));
}

/** 음높이/길이 변경 후 reflow. midi는 21~108로 clamp, durationBeats는 0.25 이상·0.25 단위로 반올림 */
export function updateNote(notes: NoteEvent[], index: number, patch: { midi?: number | null; durationBeats?: number }): NoteEvent[] {
  const base = reflow(notes);
  if (index < 0 || index >= base.length) return base;
  const cur = base[index];
  const midi = patch.midi === undefined ? cur.midi : patch.midi === null ? null : Math.min(108, Math.max(21, Math.round(patch.midi)));
  const dur = patch.durationBeats === undefined ? cur.durationBeats : Math.max(0.25, Math.round(patch.durationBeats * 4) / 4);
  base[index] = { ...cur, midi, durationBeats: dur };
  return reflow(base);
}

/** 삭제 후 reflow (범위 밖 index는 원본 복사 반환) */
export function deleteNote(notes: NoteEvent[], index: number): NoteEvent[] {
  if (index < 0 || index >= notes.length) return notes.map((n) => ({ ...n }));
  return reflow(notes.filter((_, i) => i !== index));
}

/** 0부터 시작하는 마디 번호 */
export function measureOf(beat: number, beatsPerMeasure: number): number {
  return Math.max(0, Math.floor(beat / beatsPerMeasure + EPS));
}

/** 악보 마디 수: 음표 끝과 코드 위치 중 큰 쪽 기준, 최소 1 */
export function scoreMeasureCount(score: Pick<Score, "notes" | "chords" | "beatsPerMeasure">): number {
  const bpm = score.beatsPerMeasure;
  const end = score.notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
  const byNotes = Math.ceil(end / bpm - EPS);
  const byChords = score.chords.reduce((m, c) => Math.max(m, measureOf(c.startBeat, bpm) + 1), 0);
  return Math.max(1, byNotes, byChords);
}

/** measure번째 마디 첫 박의 코드 */
export function chordAtMeasure(chords: ChordEvent[], measure: number, beatsPerMeasure: number): ChordEvent | undefined {
  const b = measure * beatsPerMeasure;
  return chords.find((c) => Math.abs(c.startBeat - b) < EPS);
}

/** 마디 첫 박에 코드 설정(있으면 교체), symbol=null 이면 삭제. startBeat 오름차순 정렬 유지 */
export function setChordAtMeasure(chords: ChordEvent[], measure: number, beatsPerMeasure: number, symbol: string | null): ChordEvent[] {
  const b = measure * beatsPerMeasure;
  const rest = chords.filter((c) => Math.abs(c.startBeat - b) >= EPS).map((c) => ({ ...c }));
  if (symbol !== null) rest.push({ startBeat: b, symbol });
  return rest.sort((x, y) => x.startBeat - y.startBeat);
}

/** 코드 품질 목록 (UI 버튼용) — theory.chordToMidi·musicxml KIND_MAP 이 처리하는 것만 */
export const CHORD_QUALITIES: readonly { suffix: string; label: string }[] = [
  { suffix: "", label: "메이저" },
  { suffix: "m", label: "마이너" },
  { suffix: "7", label: "7" },
  { suffix: "maj7", label: "maj7" },
  { suffix: "m7", label: "m7" },
  { suffix: "dim", label: "dim" },
  { suffix: "sus4", label: "sus4" },
];

const CHORD_RE = /^[A-G][#b]?(maj7|m7|m|dim|7|sus4)?(\/[A-G][#b]?)?$/;

/** "C", "F#m7", "Bb/D" 등 유효성 */
export function isValidChordSymbol(symbol: string): boolean {
  return CHORD_RE.test(symbol);
}

/** 빈 악보 생성 */
export function createBlankScore(opts: { title?: string; bpm?: number; beatsPerMeasure?: number; key?: KeyInfo } = {}): Score {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title: opts.title ?? `건반 입력 ${new Date().toLocaleString("ko-KR")}`,
    bpm: opts.bpm ?? 90,
    beatsPerMeasure: opts.beatsPerMeasure ?? 4,
    beatUnit: 4,
    key: opts.key ?? { tonic: 0, mode: "major", fifths: 0 },
    notes: [],
    chords: [],
    transpose: 0,
    createdAt: now,
    updatedAt: now,
  };
}
