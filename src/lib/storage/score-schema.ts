import { z } from "zod";
import type { Score } from "../music/types";

/** Score 와 동일한 형태의 입력 검증 스키마 (서버 경계용). 음표 숫자 데이터만 허용 — 오디오 없음. */
const isoDate = z.iso.datetime({ offset: true });

/** Server Action 본문 한도(1 MB)보다 낮게 잡은 Score 직렬화 상한(바이트) */
export const MAX_SCORE_BYTES = 900_000;

export const noteEventSchema = z.object({
  midi: z.number().int().min(0).max(127).nullable(),
  startBeat: z.number().finite().min(0).max(100_000),
  durationBeats: z.number().finite().min(0).max(100_000),
});

export const chordEventSchema = z.object({
  startBeat: z.number().finite().min(0).max(100_000),
  symbol: z.string().min(1).max(16),
});

export const keyInfoSchema = z.object({
  tonic: z.number().int().min(0).max(11),
  mode: z.enum(["major", "minor"]),
  fifths: z.number().int().min(-7).max(7),
});

export const scoreSchema = z.object({
  id: z.uuid(),
  title: z.string().max(200),
  composer: z.string().max(200).optional(),
  lyricist: z.string().max(200).optional(),
  arranger: z.string().max(200).optional(),
  headerFont: z.string().max(40).optional(),
  headerFontSize: z.number().int().min(10).max(48).optional(),
  meter: z.enum(["3/4", "4/4", "6/8"]).optional(),
  bpm: z.number().finite().min(1).max(400),
  beatsPerMeasure: z.number().int().min(1).max(32),
  beatUnit: z.literal(4),
  key: keyInfoSchema,
  notes: z.array(noteEventSchema).max(6_000),
  chords: z.array(chordEventSchema).max(1_500),
  transpose: z.number().int().min(-24).max(24),
  createdAt: isoDate,
  updatedAt: isoDate,
});

// 컴파일 타임에 Score 와 어긋나면 에러 (스키마 ↔ 타입 동기화 검증)
type _Check = z.infer<typeof scoreSchema> extends Score ? (Score extends z.infer<typeof scoreSchema> ? true : never) : never;
export const _scoreSchemaMatchesType: _Check = true;

export const scoreIdSchema = z.uuid();

export function parseScore(input: unknown): Score | null {
  const r = scoreSchema.safeParse(input);
  return r.success ? (r.data as Score) : null;
}

/** JSON 직렬화 크기(UTF-8 바이트) */
export function scoreBytes(score: unknown): number {
  return new TextEncoder().encode(JSON.stringify(score)).length;
}
