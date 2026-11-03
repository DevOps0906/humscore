import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = { id: "A" };
let scoreRow: { updated_at: string; deleted_at: string | null } | null = { updated_at: "2026-01-02T00:00:00.000Z", deleted_at: null };
let insertError: { code: string } | null = null;
const insertSpy = vi.fn();
const fromSpy = vi.fn();
const eqSpy = vi.fn();
let listData: unknown[] = [];
let statusRow: { expires_at: string | null } | null = null;

vi.mock("@/lib/storage/supabase/server", () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async () => ({ error: null }),
    from: (table: string) => {
      fromSpy(table);
      if (table === "scores" || table === "setlists") {
        const q = { eq: () => q, maybeSingle: async () => ({ data: scoreRow, error: null }) };
        return { select: () => q };
      }
      const upd = {
        eq: (c: string, v: unknown) => (eqSpy(c, v), upd),
        is: () => upd,
        lte: async () => ({ error: null }),
        then: undefined,
      };
      const sel = {
        eq: (c: string, v: unknown) => (eqSpy(c, v), sel),
        is: () => sel,
        order: () => sel,
        limit: async () => ({ data: listData, error: null }),
        maybeSingle: async () => ({ data: statusRow, error: null }),
      };
      return {
        select: () => sel,
        update: () => upd,
        insert: async (v: unknown) => {
          insertSpy(v);
          return { error: insertError };
        },
      };
    },
  }),
}));

import { createShareLink, getShareStatus, listShareLinks, reissueShareLink, revokeShareLink } from "./share";

const ID = "11111111-1111-4111-8111-111111111111";
const VER = "2026-01-02T00:00:00.000Z";

beforeEach(() => {
  user = { id: "A" };
  scoreRow = { updated_at: VER, deleted_at: null };
  insertError = null;
  insertSpy.mockReset();
  fromSpy.mockReset();
  eqSpy.mockReset();
  listData = [];
  statusRow = null;
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

const SL = "22222222-2222-4222-8222-222222222222";
const T0 = "2026-01-01T00:00:00+00:00";
const linkRow = (o: Record<string, unknown>) => ({
  score_id: null,
  setlist_id: null,
  expires_at: null,
  created_at: T0,
  scores: null,
  setlists: null,
  ...o,
});

describe("콘티 링크 겸용화 (task-020 6.1, #13 회귀)", () => {
  it("listShareLinks: score_id null 인 콘티 링크 행이 있어도 목록이 깨지지 않고 종류를 구분한다", async () => {
    listData = [
      linkRow({ setlist_id: SL, setlists: { title: "주일 1부", deleted_at: null } }),
      linkRow({ score_id: ID, scores: { title: "악보", deleted_at: null } }),
      linkRow({ setlist_id: "33333333-3333-4333-8333-333333333333", setlists: { title: "삭제됨", deleted_at: T0 } }),
      linkRow({ score_id: "44444444-4444-4444-8444-444444444444", scores: { title: "만료", deleted_at: null }, expires_at: "2020-01-01T00:00:00+00:00" }),
    ];
    const r = await listShareLinks();
    expect(r).toEqual({
      ok: true,
      data: [
        { kind: "setlist", id: SL, title: "주일 1부", expiresAt: null, createdAt: T0 },
        { kind: "score", id: ID, title: "악보", expiresAt: null, createdAt: T0 },
      ],
    });
  });
  it("revokeShareLink: 문자열(기존 호출)은 score_id, {kind:setlist} 는 setlist_id 로 필터", async () => {
    expect(await revokeShareLink(ID)).toEqual({ ok: true, data: null });
    expect(eqSpy).toHaveBeenCalledWith("score_id", ID);
    eqSpy.mockReset();
    expect(await revokeShareLink({ kind: "setlist", id: SL })).toEqual({ ok: true, data: null });
    expect(eqSpy).toHaveBeenCalledWith("setlist_id", SL);
    expect(eqSpy).not.toHaveBeenCalledWith("score_id", expect.anything());
    expect(await revokeShareLink({ kind: "x", id: SL })).toEqual({ ok: false, error: "invalid" });
  });
  it("getShareStatus: 대상별 컬럼으로 조회, 기존 문자열 호출 결과는 전과 같다", async () => {
    statusRow = { expires_at: null };
    expect(await getShareStatus(ID)).toEqual({ ok: true, data: { active: true, expiresAt: null } });
    expect(eqSpy).toHaveBeenCalledWith("score_id", ID);
    eqSpy.mockReset();
    statusRow = null;
    expect(await getShareStatus({ kind: "setlist", id: SL })).toEqual({ ok: true, data: { active: false, expiresAt: null } });
    expect(eqSpy).toHaveBeenCalledWith("setlist_id", SL);
  });
  it("createShareLink: 콘티 대상은 setlists 행을 확인하고 setlist_id 로 만료 정리·insert", async () => {
    const r = await createShareLink({ kind: "setlist", id: SL }, VER);
    expect(r.ok).toBe(true);
    expect(fromSpy).toHaveBeenCalledWith("setlists");
    expect(fromSpy).not.toHaveBeenCalledWith("scores");
    expect(eqSpy).toHaveBeenCalledWith("setlist_id", SL);
    const row = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(row.setlist_id).toBe(SL);
    expect(row).not.toHaveProperty("score_id");
  });
  it("createShareLink: 기존 문자열 호출은 score_id 로 만료 정리·insert (회귀)", async () => {
    await createShareLink(ID, VER);
    expect(fromSpy).toHaveBeenCalledWith("scores");
    expect(eqSpy).toHaveBeenCalledWith("score_id", ID);
    expect((insertSpy.mock.calls[0][0] as Record<string, unknown>).score_id).toBe(ID);
  });
  it("reissueShareLink 는 악보 전용 — 콘티 대상은 invalid", async () => {
    expect(await reissueShareLink({ kind: "setlist", id: SL }, VER)).toEqual({ ok: false, error: "invalid" });
  });
});
