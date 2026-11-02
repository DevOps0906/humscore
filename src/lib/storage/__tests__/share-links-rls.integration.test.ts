import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "../share-token";

/**
 * task-019 공유 링크 로컬 Supabase 통합 테스트 (RLS · 가드 트리거 · 익명 RPC).
 * 실행: npm run db:start 후 상태 출력의 값을 환경변수로 전달 (기본 `npm test`에서는 skip)
 *   SUPABASE_INTEGRATION=1 SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run src/lib/storage/__tests__/share-links-rls.integration.test.ts
 * 로컬(127.0.0.1 / localhost :55321) 외 URL 은 즉시 throw — 운영 DB 보호.
 */
const enabled = process.env.SUPABASE_INTEGRATION === "1";
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (enabled && !/^http:\/\/(127\.0\.0\.1|localhost):55321\/?$/.test(url)) {
  throw new Error(`통합 테스트는 로컬 Supabase(:55321)에서만 실행됩니다: ${url || "(URL 없음)"}`);
}

const run = enabled && !!anonKey && !!serviceKey;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// 해시 벡터는 Supabase 없이도 검증 가능 — 항상 실행
describe("share 해시 벡터", () => {
  it("sha256('abc') = ba7816bf… (SQL encode(sha256(..),'hex') 와 같은 표준 벡터)", () => {
    expect(hashShareToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe.skipIf(!run)("share_links 서버 계약 (로컬 Supabase)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = "";
  let bId = "";
  const password = "Test-pass-1234!";
  const stamp = Date.now();
  const DAY = 86_400_000;

  async function makeUser(tag: string) {
    const email = `it-share-${tag}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser 실패");
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return { id: data.user.id, client };
  }

  const scoreRow = (userId: string, id = randomUUID(), title = "s") => ({
    id,
    user_id: userId,
    title,
    data: { id, title },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  });

  async function newScore(client: SupabaseClient, userId: string) {
    const r = scoreRow(userId);
    const { error } = await client.from("scores").insert(r);
    if (error) throw error;
    return r.id;
  }

  /** 소유자 명의로 링크 발급. 토큰 원문과 해시 반환 */
  async function issue(client: SupabaseClient, userId: string, scoreId: string, expiresAt?: string) {
    const token = generateShareToken();
    const res = await client.from("share_links").insert({
      score_id: scoreId,
      owner_id: userId,
      token_hash: hashShareToken(token),
      expires_at: expiresAt ?? null,
    }).select("id");
    return { token, res };
  }

  beforeAll(async () => {
    admin = createClient(url, serviceKey, opts);
    anon = createClient(url, anonKey, opts);
    const ua = await makeUser("a");
    const ub = await makeUser("b");
    a = ua.client;
    b = ub.client;
    aId = ua.id;
    bId = ub.id;
  }, 60_000);

  afterAll(async () => {
    if (aId) await admin.auth.admin.deleteUser(aId); // scores·share_links 는 on delete cascade
    if (bId) await admin.auth.admin.deleteUser(bId);
  }, 60_000);

  it("정상: 소유자 발급 → anon RPC 가 제목·데이터를 받고 user_id 는 없다", async () => {
    const sid = await newScore(a, aId);
    const { token, res } = await issue(a, aId, sid);
    expect(res.error).toBeNull();
    const got = await anon.rpc("get_shared_score", { p_token: token });
    expect(got.error).toBeNull();
    expect(got.data).toHaveLength(1);
    expect(Object.keys(got.data[0]).sort()).toEqual(["data", "title"]);
    // 형식 오류·모르는 토큰은 0행 (구분 불가)
    expect((await anon.rpc("get_shared_score", { p_token: "short" })).data ?? []).toHaveLength(0);
    expect((await anon.rpc("get_shared_score", { p_token: generateShareToken() })).data ?? []).toHaveLength(0);
  });

  it("anon: share_links select·insert 불가, RPC 만 가능", async () => {
    const sid = await newScore(a, aId);
    await issue(a, aId, sid);
    const sel = await anon.from("share_links").select("id");
    expect(sel.error ?? null).not.toBeNull(); // permission denied (42501)
    const ins = await anon.from("share_links").insert({
      score_id: sid,
      owner_id: aId,
      token_hash: hashShareToken(generateShareToken()),
    });
    expect(ins.error).not.toBeNull();
  });

  it("RLS #5: 타인 악보 score_id 로 insert 거부, 타인은 링크 조회·회수 불가", async () => {
    const sid = await newScore(a, aId);
    const { token } = await issue(a, aId, sid);
    // B 명의로 A 의 악보에 발급
    const asB = await issue(b, bId, sid);
    expect(asB.res.error).not.toBeNull();
    // owner_id 를 A 로 위조
    const forged = await issue(b, aId, sid);
    expect(forged.res.error).not.toBeNull();
    // B 는 A 의 링크를 보거나 revoke 할 수 없다
    expect((await b.from("share_links").select("id").eq("score_id", sid)).data ?? []).toHaveLength(0);
    const upd = await b.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("score_id", sid).select("id");
    expect(upd.data ?? []).toHaveLength(0);
    expect((await anon.rpc("get_shared_score", { p_token: token })).data).toHaveLength(1);
  });

  it("회수: revoked_at 설정 후 RPC 0행, 같은 악보에 새 링크 발급 가능(활성 1개 제약)", async () => {
    const sid = await newScore(a, aId);
    const first = await issue(a, aId, sid);
    const dup = await issue(a, aId, sid); // 활성 링크가 이미 있음
    expect(dup.res.error?.code).toBe("23505");
    const rev = await a.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("score_id", sid).select("id");
    expect(rev.error).toBeNull();
    expect(rev.data).toHaveLength(1);
    expect((await anon.rpc("get_shared_score", { p_token: first.token })).data ?? []).toHaveLength(0);
    const second = await issue(a, aId, sid);
    expect(second.res.error).toBeNull();
  });

  it("update 는 revoked_at 만: 다른 컬럼(token_hash·expires_at·owner_id) 변경 거부", async () => {
    const sid = await newScore(a, aId);
    await issue(a, aId, sid);
    const h = await a.from("share_links").update({ token_hash: hashShareToken("abc") }).eq("score_id", sid).select("id");
    expect(h.error).not.toBeNull();
    const e = await a.from("share_links").update({ expires_at: new Date(Date.now() + DAY).toISOString() }).eq("score_id", sid).select("id");
    expect(e.error).not.toBeNull();
    const o = await a.from("share_links").update({ owner_id: bId }).eq("score_id", sid).select("id");
    expect(o.error).not.toBeNull();
  });

  it("되살리기 방지(기대: 거부): 회수된 링크의 revoked_at 을 null 로 되돌릴 수 없다", async () => {
    const sid = await newScore(a, aId);
    const { token } = await issue(a, aId, sid);
    await a.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("score_id", sid);
    const back = await a.from("share_links").update({ revoked_at: null }).eq("score_id", sid).select("id");
    const rejected = back.error !== null || (back.data ?? []).length === 0;
    expect(rejected).toBe(true);
    // 어떤 경우든 익명 열람은 계속 막혀 있어야 한다
    expect((await anon.rpc("get_shared_score", { p_token: token })).data ?? []).toHaveLength(0);
  });

  it("만료: 과거·1년 초과 expires_at insert 거부, 유효 만료일은 허용", async () => {
    const sid = await newScore(a, aId);
    const past = await issue(a, aId, sid, new Date(Date.now() - 1000).toISOString());
    expect(past.res.error?.code).toBe("22023");
    const far = await issue(a, aId, sid, new Date(Date.now() + 366 * DAY).toISOString());
    expect(far.res.error?.code).toBe("22023");
    const ok = await issue(a, aId, sid, new Date(Date.now() + 30 * DAY).toISOString());
    expect(ok.res.error).toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: ok.token })).data).toHaveLength(1);
  });

  it("삭제→복구: 악보 삭제 시 링크 꺼짐, 복구해도 꺼진 채, 삭제된 악보엔 발급 불가", async () => {
    const sid = await newScore(a, aId);
    const { token } = await issue(a, aId, sid);
    const at = new Date().toISOString();
    const del = await a.from("scores").update({ deleted_at: at, updated_at: at }).eq("id", sid).select("id");
    expect(del.error).toBeNull();
    const link = await a.from("share_links").select("revoked_at").eq("score_id", sid).single();
    expect(link.data?.revoked_at).not.toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: token })).data ?? []).toHaveLength(0);
    // 삭제 상태에서 신규 발급 거부
    expect((await issue(a, aId, sid)).res.error).not.toBeNull();
    // 복구 후에도 기존 링크는 꺼진 채
    const at2 = new Date(Date.now() + 1000).toISOString();
    const rec = await a.from("scores").update({ deleted_at: null, updated_at: at2 }).eq("id", sid).select("id");
    expect(rec.error).toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: token })).data ?? []).toHaveLength(0);
    const link2 = await a.from("share_links").select("revoked_at").eq("score_id", sid).single();
    expect(link2.data?.revoked_at).not.toBeNull();
  });

  it("재발급 RPC: 기존 링크는 꺼지고 새 링크만 열린다, 타인 악보는 거부", async () => {
    const sid = await newScore(a, aId);
    const old = await issue(a, aId, sid);
    const fresh = generateShareToken();
    const re = await a.rpc("reissue_share_link", { p_score_id: sid, p_token_hash: hashShareToken(fresh) });
    expect(re.error).toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: old.token })).data ?? []).toHaveLength(0);
    expect((await anon.rpc("get_shared_score", { p_token: fresh })).data).toHaveLength(1);
    const hijack = await b.rpc("reissue_share_link", { p_score_id: sid, p_token_hash: hashShareToken(generateShareToken()) });
    expect(hijack.error).not.toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: fresh })).data).toHaveLength(1);
  });

  it("상한: 활성 링크 200개에서 201번째 insert 는 53400", async () => {
    const uc = await makeUser("cap");
    try {
      const scores = Array.from({ length: 201 }, () => scoreRow(uc.id));
      const sres = await admin.from("scores").insert(scores);
      expect(sres.error).toBeNull();
      // 한 번에 insert 하면 행마다 트리거가 돌아 직렬화됨 (service_role 도 트리거는 적용)
      const links = scores.slice(0, 200).map((s) => ({
        score_id: s.id,
        owner_id: uc.id,
        token_hash: hashShareToken(generateShareToken()),
      }));
      for (let i = 0; i < links.length; i += 100) {
        const { error } = await admin.from("share_links").insert(links.slice(i, i + 100));
        expect(error).toBeNull();
      }
      const over = await issue(uc.client, uc.id, scores[200].id);
      expect(over.res.error?.code).toBe("53400");
    } finally {
      await admin.auth.admin.deleteUser(uc.id);
    }
  }, 120_000);
});
