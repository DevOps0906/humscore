import { fifthsFor } from "../music/theory";
import { PROGRESSIONS } from "../music/progressions";
import type { KeyInfo, Meter, NoteEvent } from "../music/types";

/** 건반 입력 화면 초안 (음표 숫자와 설정만, 오디오 아님) */
export interface KeysDraft {
  notes: NoteEvent[];
  bpm: number;
  meter: Meter;
  key: KeyInfo;
  /** "auto" = 자동 추천, 그 외 PROGRESSIONS id */
  progressionId: string;
}

export const AUTO_PROGRESSION = "auto";
export const DEFAULT_KEYS_KEY: KeyInfo = { tonic: 0, mode: "major", fifths: 0 };

const METER_IDS: readonly Meter[] = ["3/4", "4/4", "6/8"];

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
  if (!Array.isArray(o.notes)) return null;

  const bpm = typeof o.bpm === "number" && Number.isFinite(o.bpm) && o.bpm > 0 ? o.bpm : 90;

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

  return { notes: o.notes as NoteEvent[], bpm, meter, key, progressionId };
}

export function serializeKeysDraft(d: KeysDraft): string {
  return JSON.stringify(d);
}
