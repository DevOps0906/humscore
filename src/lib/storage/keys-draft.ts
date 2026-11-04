import { z } from "zod";
import { chordEventSchema, noteEventSchema } from "./score-schema";
import { fifthsFor } from "../music/theory";
import { PROGRESSIONS } from "../music/progressions";
import { isValidChordSymbol } from "../music/edit";
import type { ChordEvent, KeyInfo, Meter, NoteEvent } from "../music/types";

/** 건반 입력 화면 초안 (음표 숫자와 설정만, 오디오 아님) */
export interface KeysDraft {
  /** 작곡 도구로 저장한 악보를 다시 열 때 같은 악보에 이어서 저장한다. */
  scoreId?: string;
  notes: NoteEvent[];
  bpm: number;
  meter: Meter;
  key: KeyInfo;
  /** "auto" = 자동 추천, 그 외 PROGRESSIONS id */
  progressionId: string;
  /** 사용자가 수정한 코드. 없으면 선택한 코드 진행 또는 자동 추천을 사용 */
  chords?: ChordEvent[];
}

export const AUTO_PROGRESSION = "auto";
export const DEFAULT_KEYS_KEY: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };

const METER_IDS: readonly Meter[] = ["3/4", "4/4", "6/8"];
const BPM_MIN = 30;
const BPM_MAX = 240;
const notesSchema = z.array(noteEventSchema).max(6_000);
const chordsSchema = z.array(chordEventSchema.refine((chord) => isValidChordSymbol(chord.symbol))).max(1_500);

export function parseKeysDraft(raw: string | null): KeysDraft | null {
  if (!raw) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const scoreId = typeof o.scoreId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.scoreId)
    ? o.scoreId : undefined;
  if (!Array.isArray(o.notes)) return null;

  // 원소 하나라도 검증 실패하면 초안 전체 폐기: 일부만 살리면 박/음이 빠진 채 조용히
  // 다른 선율이 되어 저장될 수 있다. 손상된 초안은 아예 없는 편이 안전하다.
  const parsedNotes = notesSchema.safeParse(o.notes);
  if (!parsedNotes.success) return null;

  const bpm =
    typeof o.bpm === "number" && Number.isFinite(o.bpm) && o.bpm > 0
      ? Math.min(BPM_MAX, Math.max(BPM_MIN, o.bpm))
      : 90;

  // 예전 초안은 beatsPerMeasure 만 있음: 3 → 3/4, 그 외 → 4/4
  const meter: Meter = METER_IDS.includes(o.meter as Meter)
    ? (o.meter as Meter)
    : o.beatsPerMeasure === 3
      ? "3/4"
      : "4/4";

  let key: KeyInfo = DEFAULT_KEYS_KEY;
  const k = o.key as Record<string, unknown> | undefined;
  if (k && typeof k === "object" && Number.isInteger(k.tonic) && (k.mode === "major" || k.mode === "minor")) {
    const tonic = (((k.tonic as number) % 12) + 12) % 12;
    key = { tonic, mode: k.mode, fifths: fifthsFor(tonic, k.mode) };
  }

  const progressionId =
    typeof o.progressionId === "string" && PROGRESSIONS.some((p) => p.id === o.progressionId)
      ? o.progressionId
      : AUTO_PROGRESSION;

  if (o.chords !== undefined) {
    const parsedChords = chordsSchema.safeParse(o.chords);
    if (!parsedChords.success) return null;
    return { notes: parsedNotes.data, bpm, meter, key, progressionId, chords: parsedChords.data, ...(scoreId ? { scoreId } : {}) };
  }
  return { notes: parsedNotes.data, bpm, meter, key, progressionId, ...(scoreId ? { scoreId } : {}) };
}

export function serializeKeysDraft(d: KeysDraft): string {
  return JSON.stringify(d);
}
