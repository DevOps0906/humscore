import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = { id: "A" };
let updateResult: { data: unknown[] | null; error: { code: string } | null } = { data: [], error: null };
let insertResult: { data: unknown; error: { code: string } | null } = { data: null, error: null };
const eqSpy = vi.fn();
const updateSpy = vi.fn();
const insertSpy = vi.fn();

vi.mock("@/lib/storage/supabase/server", () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: () => {
      const upd = {
        eq: (c: string, v: unknown) => (eqSpy(c, v), upd),
        is: () => upd,
        select: async () => updateResult,
      };
      return {
        update: (v: unknown) => (updateSpy(v), upd),
        insert: (v: unknown) => {
          insertSpy(v);
          return { select: () => ({ single: async () => insertResult }) };
        },
      };
    },
  }),
}));

import { createSetlist, saveSetlist } from "./setlists";

const ID = "22222222-2222-4222-8222-222222222222";
const SID = "11111111-1111-4111-8111-111111111111";
const BASE = "2026-11-03T10:00:00.123456+00:00";
const NEXT = "2026-11-03T10:00:05.654321+00:00";
const input = () => ({
  title: "주일 1부",
  serviceDate: "2026-11-08",
  memo: null,
  shareNotes: true,
  items: [{ scoreId: SID, transpose: 2, bpm: null, form: null, note: null, transition: null }],
});

beforeEach(() => {
  user = { id: "A" };
  updateResult = { data: [{ updated_at: NEXT }], error: null };
  insertResult = { data: { id: ID, updated_at: BASE }, error: null };
  eqSpy.mockReset();
  updateSpy.mockReset();
  insertSpy.mockReset();
});

describe("saveSetlist (CAS, #3)", () => {
  it("기준 updated_at 문자열을 그대로(마이크로초 포함) 조건에 넣고, 서버가 준 새 updatedAt 을 돌려준다", async () => {
    expect(await saveSetlist(ID, input(), BASE)).toEqual({ ok: true, data: { updatedAt: NEXT } });
    expect(eqSpy).toHaveBeenCalledWith("updated_at", BASE);
    expect(eqSpy).toHaveBeenCalledWith("user_id", "A");
    expect(eqSpy).toHaveBeenCalledWith("id", ID);
  });
  it("0행이면 stale — 덮어쓰기 없음", async () => {
    updateResult = { data: [], error: null };
    expect(await saveSetlist(ID, input(), BASE)).toEqual({ ok: false, error: "stale" });
  });
  it("updated_at 은 본문으로 보내지 않는다(서버 now())", async () => {
    await saveSetlist(ID, input(), BASE);
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("updated_at");
    expect(updateSpy.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
  it("입력 검증(#6): 잘못된 id·기준 시각·51곡·범위 밖 transpose 는 invalid, DB 호출 없음", async () => {
    expect(await saveSetlist("x", input(), BASE)).toEqual({ ok: false, error: "invalid" });
    expect(await saveSetlist(ID, input(), "x")).toEqual({ ok: false, error: "invalid" });
    const many = { ...input(), items: Array.from({ length: 51 }, () => input().items[0]) };
    expect(await saveSetlist(ID, many, BASE)).toEqual({ ok: false, error: "invalid" });
    const bad = { ...input(), items: [{ ...input().items[0], transpose: 30 }] };
    expect(await saveSetlist(ID, bad, BASE)).toEqual({ ok: false, error: "invalid" });
    expect(updateSpy).not.toHaveBeenCalled();
  });
  it("DB 소유 확인 트리거 거부(23514)는 invalid", async () => {
    updateResult = { data: null, error: { code: "23514" } };
    expect(await saveSetlist(ID, input(), BASE)).toEqual({ ok: false, error: "invalid" });
  });
  it("비로그인이면 unauthenticated", async () => {
    user = null;
    expect(await saveSetlist(ID, input(), BASE)).toEqual({ ok: false, error: "unauthenticated" });
  });
});

describe("createSetlist", () => {
  it("본인 user_id 로 insert, 서버 id·updatedAt 반환", async () => {
    expect(await createSetlist(input())).toEqual({ ok: true, data: { id: ID, updatedAt: BASE } });
    const row = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(row.user_id).toBe("A");
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("updated_at");
  });
  it("2000개 상한(53400)은 limit", async () => {
    insertResult = { data: null, error: { code: "53400" } };
    expect(await createSetlist(input())).toEqual({ ok: false, error: "limit" });
  });
});
