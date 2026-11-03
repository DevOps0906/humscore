import { describe, expect, it } from "vitest";
import { jsonbTextBytes, SETLIST_LIMITS, setlistInputSchema, setlistItemSchema, setlistItemsSchema } from "./setlist-schema";

const SID = "11111111-1111-4111-8111-111111111111";
const item = (o: Record<string, unknown> = {}) => ({ scoreId: SID, transpose: 0, bpm: null, form: null, note: null, transition: null, ...o });
const input = (o: Record<string, unknown> = {}) => ({ title: "주일 1부", serviceDate: "2026-11-08", memo: null, shareNotes: true, items: [item()], ...o });

describe("setlist-schema (#6 zod 쪽)", () => {
  it("정상 입력 통과", () => {
    expect(setlistInputSchema.safeParse(input()).success).toBe(true);
    expect(setlistItemSchema.safeParse(item({ transpose: -24, bpm: 400, form: "전주-A-B" })).success).toBe(true);
  });
  it("범위 밖 transpose·bpm, 정수 아닌 transpose 거부", () => {
    for (const o of [{ transpose: 25 }, { transpose: -25 }, { transpose: 1.5 }, { bpm: 0 }, { bpm: 401 }]) {
      expect(setlistItemSchema.safeParse(item(o)).success).toBe(false);
    }
  });
  it("uuid 아닌 scoreId·모르는 키 거부", () => {
    expect(setlistItemSchema.safeParse(item({ scoreId: "x" })).success).toBe(false);
    expect(setlistItemSchema.safeParse(item({ extra: 1 })).success).toBe(false);
  });
  it("텍스트 상한: title 100·memo 1000·form 200·note 500·transition 300", () => {
    expect(setlistInputSchema.safeParse(input({ title: "a".repeat(101) })).success).toBe(false);
    expect(setlistInputSchema.safeParse(input({ memo: "a".repeat(1001) })).success).toBe(false);
    expect(setlistItemSchema.safeParse(item({ form: "a".repeat(201) })).success).toBe(false);
    expect(setlistItemSchema.safeParse(item({ note: "a".repeat(501) })).success).toBe(false);
    expect(setlistItemSchema.safeParse(item({ transition: "a".repeat(301) })).success).toBe(false);
    expect(setlistItemSchema.safeParse(item({ transition: "a".repeat(300) })).success).toBe(true);
  });
  it("51곡 거부, 50곡 허용", () => {
    expect(setlistItemsSchema.safeParse(Array.from({ length: 50 }, () => item())).success).toBe(true);
    expect(setlistItemsSchema.safeParse(Array.from({ length: 51 }, () => item())).success).toBe(false);
  });
  it("items 64KB(jsonb text 기준) 초과 거부", () => {
    const big = Array.from({ length: 50 }, () => item({ note: "가".repeat(500), transition: "나".repeat(300), form: "다".repeat(200) }));
    expect(jsonbTextBytes(big)).toBeGreaterThan(SETLIST_LIMITS.itemsBytes);
    expect(setlistItemsSchema.safeParse(big).success).toBe(false);
  });
  it("jsonbTextBytes 는 Postgres jsonb::text 모양(구분자 뒤 공백)으로 센다", () => {
    expect(jsonbTextBytes([{ a: 1, b: null }])).toBe('[{"a": 1, "b": null}]'.length);
    expect(jsonbTextBytes([])).toBe(2);
    expect(jsonbTextBytes(["가"])).toBe(2 + 2 + 3);
  });
  it("예배일은 YYYY-MM-DD, updated_at 은 입력에서 받지 않는다", () => {
    expect(setlistInputSchema.safeParse(input({ serviceDate: "2026-13-01" })).success).toBe(false);
    expect(setlistInputSchema.safeParse(input({ updatedAt: "2026-01-01T00:00:00Z" })).success).toBe(false);
  });
});
