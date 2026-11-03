import { z } from "zod";

/**
 * 찬양 콘티(setlists) 입력 검증 — 서버 경계용. DB check(20261103100000_setlists.sql)와 같은 상한.
 * 원본 Score 는 건드리지 않고, 항목마다 transpose(원본 기준 절대값)만 저장한다.
 */
export const SETLIST_LIMITS = {
  items: 50,
  itemsBytes: 65_536,
  title: 100,
  memo: 1000,
  form: 200,
  note: 500,
  transition: 300,
} as const;

export const setlistIdSchema = z.uuid();

export const setlistItemSchema = z.strictObject({
  scoreId: z.uuid(),
  transpose: z.number().int().min(-24).max(24),
  /** null = 원본 bpm */
  bpm: z.number().finite().min(1).max(400).nullable(),
  form: z.string().max(SETLIST_LIMITS.form).nullable(),
  note: z.string().max(SETLIST_LIMITS.note).nullable(),
  transition: z.string().max(SETLIST_LIMITS.transition).nullable(),
});

export type SetlistItem = z.infer<typeof setlistItemSchema>;

/**
 * Postgres `jsonb::text` 와 같은 모양(`{"k": v, "k2": v2}`, `[a, b]`)으로 직렬화했을 때의 UTF-8 바이트.
 * DB check `octet_length(items::text) <= 65536` 과 맞추기 위해 JSON.stringify 보다 구분자 공백만큼 크게 센다.
 */
export function jsonbTextBytes(value: unknown): number {
  const enc = new TextEncoder();
  const walk = (v: unknown): number => {
    if (Array.isArray(v)) {
      if (v.length === 0) return 2;
      return 2 + v.reduce<number>((n, x) => n + walk(x), 0) + (v.length - 1) * 2;
    }
    if (v !== null && typeof v === "object") {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      if (entries.length === 0) return 2;
      return 2 + entries.reduce((n, [k, x]) => n + enc.encode(JSON.stringify(k)).length + 2 + walk(x), 0) + (entries.length - 1) * 2;
    }
    return enc.encode(JSON.stringify(v) ?? "null").length;
  };
  return walk(value);
}

export const setlistItemsSchema = z
  .array(setlistItemSchema)
  .max(SETLIST_LIMITS.items)
  .refine((items) => jsonbTextBytes(items) <= SETLIST_LIMITS.itemsBytes, { message: "items too large" });

/** 저장 입력(클라이언트 → Server Action). updated_at 은 받지 않는다(서버 now()). */
export const setlistInputSchema = z.strictObject({
  title: z.string().max(SETLIST_LIMITS.title),
  serviceDate: z.iso.date(),
  memo: z.string().max(SETLIST_LIMITS.memo).nullable(),
  shareNotes: z.boolean(),
  items: setlistItemsSchema,
});

export type SetlistInput = z.infer<typeof setlistInputSchema>;

/** 서버 행 → 앱 형태. updatedAt 은 서버가 준 문자열 그대로(CAS 기준, Date 변환 금지) */
export type Setlist = SetlistInput & { id: string; updatedAt: string };

export type SetlistSummary = { id: string; title: string; serviceDate: string; itemCount: number; updatedAt: string };
