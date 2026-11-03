import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = { id: "A" };
let scoreRow: { updated_at: string; deleted_at: string | null } | null = { updated_at: "2026-01-02T00:00:00.000Z", deleted_at: null };
let insertError: { code: string } | null = null;
const insertSpy = vi.fn();

vi.mock("@/lib/storage/supabase/server", () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async () => ({ error: null }),
    from: (table: string) => {
      if (table === "scores") {
        const q = { eq: () => q, maybeSingle: async () => ({ data: scoreRow, error: null }) };
        return { select: () => q };
      }
      const upd = { eq: () => upd, is: () => upd, lte: async () => ({ error: null }), then: undefined };
      return {
        update: () => upd,
        insert: async (v: unknown) => {
          insertSpy(v);
          return { error: insertError };
        },
      };
    },
  }),
}));

import { createShareLink } from "./share";

const ID = "11111111-1111-4111-8111-111111111111";
const VER = "2026-01-02T00:00:00.000Z";

beforeEach(() => {
  user = { id: "A" };
  scoreRow = { updated_at: VER, deleted_at: null };
  insertError = null;
  insertSpy.mockReset();
});

describe("createShareLink", () => {
  it("성공: 토큰 URL 경로를 한 번 돌려주고 DB 에는 해시만 넣는다", async () => {
    const r = await createShareLink(ID, VER);
    expect(r.ok).toBe(true);
    if (!r.ok || r.data.state !== "created") throw new Error("created 기대");
    const token = r.data.path.replace("/s/", "");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = insertSpy.mock.calls[0][0] as { token_hash: string; owner_id: string };
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.owner_id).toBe("A");
  });
  it("비로그인이면 unauthenticated", async () => {
    user = null;
    expect(await createShareLink(ID, VER)).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("서버에 없거나 삭제된 악보는 unsynced, updatedAt 불일치는 stale", async () => {
    scoreRow = null;
    expect(await createShareLink(ID, VER)).toEqual({ ok: false, error: "unsynced" });
    scoreRow = { updated_at: VER, deleted_at: VER };
    expect(await createShareLink(ID, VER)).toEqual({ ok: false, error: "unsynced" });
    scoreRow = { updated_at: "2026-01-03T00:00:00.000Z", deleted_at: null };
    expect(await createShareLink(ID, VER)).toEqual({ ok: false, error: "stale" });
  });
  it("입력 검증: 잘못된 id·updatedAt·과거 만료일은 invalid", async () => {
    expect(await createShareLink("x", VER)).toEqual({ ok: false, error: "invalid" });
    expect(await createShareLink(ID, "x")).toEqual({ ok: false, error: "invalid" });
    expect(await createShareLink(ID, VER, "2020-01-01T00:00:00.000Z")).toEqual({ ok: false, error: "invalid" });
  });
  it("부분 유니크 위반(23505)은 오류가 아니라 already", async () => {
    insertError = { code: "23505" };
    expect(await createShareLink(ID, VER)).toEqual({ ok: true, data: { state: "already" } });
  });
  it("상한 초과(53400)는 limit", async () => {
    insertError = { code: "53400" };
    expect(await createShareLink(ID, VER)).toEqual({ ok: false, error: "limit" });
  });
});
