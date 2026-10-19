import { deleteNote, insertNote, STEP_DURATIONS, updateNote } from "@/lib/music/edit";
import { intervalName } from "@/lib/music/spelling";
import { midiToName, PIANO_MAX_MIDI, PIANO_MIN_MIDI } from "@/lib/music/frequency";
import type { NoteEvent } from "@/lib/music/types";


/** 박(startBeat) → 비교용 정수 키 (1/16박 해상도) */
export const beatKey = (beat: number): number => Math.round(beat * 16);

/**
 * 시작 박 → Score 음표 index.
 * 화면의 그래픽 음표는 "시작 시각이 어떤 Score 음표의 startBeat 와 일치하는 첫 조각"에만 커서를 둔다.
 * 마디를 넘는 붙임줄 이어지는 조각·표기 불가 음가를 쪼갠 뒷조각·마디 채움 쉼표는 시작 시각이
 * 어떤 음표와도 일치하지 않아 자연히 제외된다(OSMD 가 박 경계에서 추가로 쪼개도 안전).
 */
export function noteIndexByStart(notes: NoteEvent[]): Map<number, number> {
  const map = new Map<number, number>();
  notes.forEach((n, i) => {
    const k = beatKey(n.startBeat);
    if (!map.has(k)) map.set(k, i);
  });
  return map;
}

// ---- 음가 도우미 (DurationPicker 와 같은 규칙) ----
const DOTTED = [0.75, 1.5, 3];

/** 기본 음가(base)를 고르되, 현재가 점음표이고 점음표가 허용되면 점을 유지 */
export function withBaseDuration(current: number, base: number): number {
  const dotted = DOTTED.includes(current);
  return dotted && STEP_DURATIONS.includes(base * 1.5) ? base * 1.5 : base;
}

/** 점 토글 (허용되지 않으면 그대로) */
export function toggleDot(current: number): number {
  if (DOTTED.includes(current)) return current / 1.5;
  return STEP_DURATIONS.includes(current * 1.5) ? current * 1.5 : current;
}

const DIGIT_BASE: Record<string, number> = { "1": 0.25, "2": 0.5, "3": 1, "4": 2, "5": 4 };

export const DURATION_NAMES: Record<number, string> = {
  0.25: "16분음표",
  0.5: "8분음표",
  0.75: "점8분음표",
  1: "4분음표",
  1.5: "점4분음표",
  2: "2분음표",
  3: "점2분음표",
  4: "온음표",
};

/** 스크린리더용 안내문. 예: "3번째 음표 · E4 · 4분음표" (화면 표기 = 저장 midi + transpose) */
export function describeNote(notes: NoteEvent[], index: number, transpose: number, preferFlats: boolean): string {
  const n = notes[index];
  if (!n) return "";
  const dur = DURATION_NAMES[n.durationBeats] ?? `${n.durationBeats}박`;
  const pitch = n.midi === null ? "쉼표" : midiToName(n.midi + transpose, preferFlats);
  return `${index + 1}번째 ${n.midi === null ? "쉼표" : "음표"} · ${pitch} · ${dur}`;
}

export interface KeyResult {
  notes?: NoteEvent[];
  sel: number | null;
  /** 소리로 들려줄 저장(원본 키) midi */
  play?: number;
}

/** 키 입력 처리. 처리하지 않는 키는 null (기본 동작 유지) */
export function applyEditKey(notes: NoteEvent[], sel: number | null, key: string, shift = false): KeyResult | null {
  const last = notes.length - 1;
  const has = sel !== null && sel >= 0 && sel <= last;
  const cur = has ? notes[sel!] : null;
  const s = has ? sel! : null;

  switch (key) {
    case "ArrowLeft":
      if (last < 0) return { sel: null };
      return { sel: s === null ? 0 : Math.max(0, s - 1) };
    case "ArrowRight":
      if (last < 0) return { sel: null };
      return { sel: s === null ? 0 : Math.min(last, s + 1) };
    case "Home":
      return { sel: last < 0 ? null : 0 };
    case "End":
      return { sel: last < 0 ? null : last };
    case "ArrowUp":
    case "ArrowDown": {
      if (s === null) return { sel: s };
      if (cur?.midi == null) return { sel: s };
      const step = (shift ? 12 : 1) * (key === "ArrowUp" ? 1 : -1);
      const next = cur.midi + step;
      if (next < PIANO_MIN_MIDI || next > PIANO_MAX_MIDI) return { sel: s };
      return { notes: updateNote(notes, s, { midi: next }), sel: s, play: next };
    }
    case "1":
    case "2":
    case "3":
    case "4":
    case "5": {
      if (s === null || !cur) return { sel: s };
      return { notes: updateNote(notes, s, { durationBeats: withBaseDuration(cur.durationBeats, DIGIT_BASE[key]) }), sel: s };
    }
    case ".": {
      if (s === null || !cur) return { sel: s };
      const d = toggleDot(cur.durationBeats);
      if (d === cur.durationBeats) return { sel: s };
      return { notes: updateNote(notes, s, { durationBeats: d }), sel: s };
    }
    case "Delete":
    case "Backspace": {
      if (s === null) return { sel: s };
      const next = deleteNote(notes, s);
      return { notes: next, sel: next.length === 0 ? null : Math.max(0, s - 1) };
    }
    case "Enter": {
      if (s === null || !cur) return { sel: s };
      return { notes: insertNote(notes, s + 1, cur.midi, cur.durationBeats), sel: s + 1 };
    }
    default:
      return null;
  }
}

export interface MarkRect {
  /** 악보 컨테이너 좌표(px) */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 클릭 지점(x,y)에서 가장 가까운 음표 index. pad(px)만큼 여유 */
export function hitTestMarks(marks: (MarkRect | undefined)[], x: number, y: number, pad = 10): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  marks.forEach((r, i) => {
    if (!r) return;
    if (x < r.left - pad || x > r.left + r.width + pad || y < r.top - pad || y > r.top + r.height + pad) return;
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** 드래그 한 칸(반음)당 픽셀 */
export const DRAG_STEP_PX = 10;

/** 위로 끌면 양수. startY - y 를 반음 수로 */
export function dragSteps(startY: number, y: number, stepPx = DRAG_STEP_PX): number {
  return Math.round((startY - y) / stepPx) || 0;
}

/** 드래그 결과 midi (저장 midi 기준, 피아노 범위로 clamp) */
export function dragTargetMidi(startMidi: number, steps: number): number {
  return Math.min(PIANO_MAX_MIDI, Math.max(PIANO_MIN_MIDI, startMidi + steps));
}

/** 앞 음과의 음정 안내. 예: "앞 음과 장3도 ↑". 쉼표이거나 앞이 쉼표/없음이면 null. 화면 키(transpose 적용) 기준 */
export function describeInterval(
  notes: NoteEvent[],
  index: number,
  transpose: number,
  key: { fifths: number; mode: "major" | "minor" },
): string | null {
  const cur = notes[index];
  const prev = notes[index - 1];
  if (!cur || !prev || cur.midi === null || prev.midi === null) return null;
  const a = prev.midi + transpose;
  const b = cur.midi + transpose;
  const name = intervalName(Math.min(a, b), Math.max(a, b), key);
  const dir = b > a ? " ↑" : b < a ? " ↓" : "";
  return `앞 음과 ${name}${dir}`;
}
