import { z } from "zod";
import type { Score } from "../music/types";
import { isInstrumentId } from "../music/instrument-catalog";
import { isArpeggioPatternId } from "../music/accompaniment";

/** Score 와 동일한 형태의 입력 검증 스키마 (서버 경계용). 음표 숫자 데이터만 허용 — 오디오 없음. */
const isoDate = z.iso.datetime({ offset: true });

/** Server Action 본문 한도(1 MB)보다 낮게 잡은 Score 직렬화 상한(바이트) */
export const MAX_SCORE_BYTES = 900_000;

/** 음표 하나에 붙는 가사 음절 최대 길이(글자) */
export const MAX_LYRIC_LENGTH = 40;

export const noteEventSchema = z.object({
  midi: z.number().int().min(0).max(127).nullable(),
  startBeat: z.number().finite().min(0).max(100_000),
  durationBeats: z.number().finite().min(0).max(100_000),
  /** 사용자가 확인·적용한 가사 음절 (텍스트만, 음성 아님) */
  lyric: z.string().min(1).max(MAX_LYRIC_LENGTH).optional(),
  lyrics: z.record(z.string().regex(/^[1-9]\d?$/), z.string().min(1).max(MAX_LYRIC_LENGTH)).optional(),
  tieToNext: z.boolean().optional(),
  slurToNext: z.boolean().optional(),
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

export const dynamicEventSchema = z.object({
  startBeat: z.number().finite().min(0).max(100_000),
  kind: z.enum(["pp", "p", "mp", "mf", "f", "ff", "cresc", "dim"]),
  durationBeats: z.number().finite().gt(0).max(100_000).optional(),
});

export const measureMarkSchema = z.object({
  measure: z.number().int().min(0).max(10_000),
  kind: z.enum([
    "repeatStart", "repeatEnd", "segno", "coda", "fine", "toCoda",
    "dc", "dcAlFine", "dcAlCoda", "ds", "dsAlFine", "dsAlCoda",
  ]),
});

export const accompanimentSchema = z.object({
  mode: z.enum(["block", "arpeggio"]),
  pattern: z.custom<string>((value) => isArpeggioPatternId(value), "알 수 없는 아르페지오 패턴입니다"),
});

export const scorePartSchema = z.object({
  partName: z.string().trim().min(1).max(80).optional(),
  clef: z.enum(["treble", "bass"]).optional(),
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).refine((id) => id !== "main"),
  notation: z.enum(["piano", "guitarTab", "drums", "orchestra"]),
  instrument: z.custom<NonNullable<Score["instrument"]>>(isInstrumentId, "알 수 없는 악기 음색입니다"),
  notes: z.array(noteEventSchema).max(6_000),
  chords: z.array(chordEventSchema).max(1_500),
  accompaniment: accompanimentSchema.optional(),
  dynamics: z.array(dynamicEventSchema).max(2_000).optional(),
});

export const scorePartsSchema = z.array(scorePartSchema).max(32).refine((parts) => new Set(parts.map((part) => part.id)).size === parts.length, "악기 파트 ID가 중복됐어요");

export const scoreSchema = z.object({
  partName: z.string().trim().min(1).max(80).optional(),
  clef: z.enum(["treble", "bass"]).optional(),
  measureCount: z.number().int().min(1).max(128).optional(),
  parts: scorePartsSchema.optional(),
  id: z.uuid(),
  title: z.string().max(200),
  notation: z.enum(["piano", "guitarTab", "drums", "orchestra"]).optional(),
  instrument: z.custom<NonNullable<Score["instrument"]>>(isInstrumentId, "알 수 없는 악기 음색입니다").optional(),
  accompaniment: z.object({
    mode: z.enum(["block", "arpeggio"]),
    pattern: z.custom<string>((value) => isArpeggioPatternId(value), "알 수 없는 아르페지오 패턴입니다"),
  }).optional(),
  composer: z.string().max(200).optional(),
  lyricist: z.string().max(200).optional(),
  arranger: z.string().max(200).optional(),
  headerFont: z.string().max(40).optional(),
  headerFontSize: z.number().int().min(10).max(48).optional(),
  headerFontWeight: z.number().int().min(100).max(900).multipleOf(100).optional(),
  meter: z.enum(["3/4", "4/4", "6/8"]).optional(),
  bpm: z.number().finite().min(1).max(400),
  beatsPerMeasure: z.number().int().min(1).max(32),
  beatUnit: z.literal(4),
  key: keyInfoSchema,
  notes: z.array(noteEventSchema).max(6_000),
  chords: z.array(chordEventSchema).max(1_500),
  dynamics: z.array(dynamicEventSchema).max(2_000).optional(),
  marks: z.array(measureMarkSchema).max(500).optional(),
  transpose: z.number().int().min(-24).max(24),
  createdAt: isoDate,
  updatedAt: isoDate,
}).refine((s) => s.meter !== "6/8" || s.beatsPerMeasure === 3, {
  // 6/8 은 내부적으로 4분음표 3박 — 다른 값이면 박자표와 마디 길이가 어긋난다
  message: "meter 6/8 은 beatsPerMeasure 3 과 함께여야 합니다",
  path: ["meter"],
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
