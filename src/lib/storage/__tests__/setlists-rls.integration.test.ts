import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "../share-token";

/**
 * task-020 콘티(setlists)·콘티 공유 링크 로컬 Supabase 통합 테스트 (V3: RLS · 트리거 · check · 익명 RPC).
 * 실행: npm run db:start 후 상태 출력의 값을 환경변수로 전달 (기본 `npm test`에서는 skip)
 *   SUPABASE_INTEGRATION=1 SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run src/lib/storage/__tests__/setlists-rls.integration.test.ts
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

describe.skipIf(!run)("setlists·콘티 공유 서버 계약 (로컬 Supabase)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = "";
  let bId = "";
  const password = "Test-pass-1234!";
  const stamp = Date.now();

  async function makeUser(tag: string) {
    const email = `it-setlist-${tag}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser 실패");
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return { id: data.user.id, client };
  }

  async function newScore(client: SupabaseClient, userId: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID();
    const { error } = await client.from("scores").insert({
      id,
      user_id: userId,
      title: `곡-${id.slice(0, 4)}`,
      data: { id, title: "s", bpm: 120, transpose: 0, key: { tonic: 0, mode: "major", fifths: 0 }, ...extra },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    if (error) throw error;
    return id;
  }

  const item = (scoreId: unknown, o: Record<string, unknown> = {}) => ({
    scoreId,
    transpose: 0,
    bpm: null,
    form: "전주-A-B",
    note: "곡 메모",
    transition: "전환 메모",
    ...o,
  });

  async function newSetlist(client: SupabaseClient, userId: string, items: unknown[] = [], o: Record<string, unknown> = {}) {
    return client
      .from("setlists")
      .insert({ user_id: userId, title: "주일 1부", service_date: "2026-11-08", memo: "인도자 멘트", items, ...o })
      .select("id, updated_at")
      .single();
  }

  async function issue(client: SupabaseClient, userId: string, target: { score_id?: string; setlist_id?: string }) {
    const token = generateShareToken();
    const res = await client.from("share_links").insert({ ...target, owner_id: userId, token_hash: hashShareToken(token) }).select("id");
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
    if (aId) await admin.auth.admin.deleteUser(aId);
    if (bId) await admin.auth.admin.deleteUser(bId);
  }, 60_000);

  it("악보 선택·미리보기는 제목·조성·템포·전조만 조회한다", async () => {
    const sid = await newScore(a, aId, { transpose: 3, bpm: 96 });
    const { data, error } = await a.from("scores")
      .select("id, title, deleted_at, transpose:data->>transpose, bpm:data->>bpm, key:data->key")
      .eq("user_id", aId)
      .eq("id", sid)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: sid,
      transpose: "3",
      bpm: "96",
      key: { tonic: 0, mode: "major", fifths: 0 },
      deleted_at: null,
    });
  });

  it("#1 생성·순서 변경·저장 후 목록이 예배일 내림차순, item_count 반영", async () => {
    const u = await makeUser("order");
    try {
      const s1 = await newScore(u.client, u.id);
      const s2 = await newScore(u.client, u.id);
      await newSetlist(u.client, u.id, [], { service_date: "2026-10-04", title: "10월" });
      const nov = await newSetlist(u.client, u.id, [item(s1), item(s2)], { service_date: "2026-11-08", title: "11월" });
      await newSetlist(u.client, u.id, [], { service_date: "2026-09-06", title: "9월" });
      const re = await u.client
        .from("setlists")
        .update({ items: [item(s2), item(s1)] })
        .eq("id", nov.data!.id)
        .eq("updated_at", nov.data!.updated_at)
        .select("items");
      expect(re.error).toBeNull();
      expect((re.data![0].items as { scoreId: string }[]).map((x) => x.scoreId)).toEqual([s2, s1]);
      const list = await u.client.from("setlists").select("title, item_count").is("deleted_at", null).order("service_date", { ascending: false });
      expect(list.data).toEqual([
        { title: "11월", item_count: 2 },
        { title: "10월", item_count: 0 },
        { title: "9월", item_count: 0 },
      ]);
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  it("#3 CAS: 같은 기준으로 동시 저장하면 한쪽만 반영, 늦은 쪽 0행", async () => {
    const sid = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(sid)]);
    expect(sl.error).toBeNull();
    const base = sl.data!.updated_at as string;
    const save = (title: string) =>
      a.from("setlists").update({ title }).eq("id", sl.data!.id).eq("user_id", aId).eq("updated_at", base).select("updated_at");
    const [r1, r2] = await Promise.all([save("탭1"), save("탭2")]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect((r1.data ?? []).length + (r2.data ?? []).length).toBe(1);
    // 기준이 낡은 세 번째 저장도 0행
    expect((await save("탭3")).data ?? []).toHaveLength(0);
    const now = await a.from("setlists").select("title").eq("id", sl.data!.id).single();
    expect(["탭1", "탭2"]).toContain(now.data!.title);
  });

  it("#4 클라이언트가 보낸 updated_at 은 무시되고 서버 now() 가 저장된다", async () => {
    const before = Date.now() - 60_000;
    const sl = await newSetlist(a, aId, [], { updated_at: "2000-01-01T00:00:00Z" });
    expect(sl.error).toBeNull();
    expect(Date.parse(sl.data!.updated_at as string)).toBeGreaterThan(before);
    const up = await a.from("setlists").update({ updated_at: "2999-01-01T00:00:00Z", title: "x" }).eq("id", sl.data!.id).select("updated_at");
    expect(Date.parse(up.data![0].updated_at as string)).toBeLessThan(Date.now() + 60_000);
  });

  it("#5 사용자당 2001번째 살아있는 콘티 insert → 53400", async () => {
    const u = await makeUser("cap");
    try {
      const rows = Array.from({ length: 2000 }, () => ({ user_id: u.id, title: "c", service_date: "2026-01-01" }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from("setlists").insert(rows.slice(i, i + 500));
        expect(error).toBeNull();
      }
      const over = await newSetlist(u.client, u.id);
      expect(over.error?.code).toBe("53400");
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  }, 180_000);

  it("#6 DB check: 51곡·64KB 초과·범위 밖 transpose/bpm·상한 넘는 텍스트·모르는 키 거부", async () => {
    const sid = await newScore(a, aId);
    const bad: unknown[][] = [
      Array.from({ length: 51 }, () => item(sid)),
      [item(sid, { transpose: 25 })],
      [item(sid, { transpose: 1.5 })],
      [item(sid, { bpm: 0 })],
      [item(sid, { bpm: 401 })],
      [item(sid, { form: "a".repeat(201) })],
      [item(sid, { note: "a".repeat(501) })],
      [item(sid, { transition: "a".repeat(301) })],
      [item(sid, { extra: 1 })],
      [item(sid, { transpose: "1" })],
    ];
    for (const items of bad) {
      const r = await newSetlist(a, aId, items);
      expect(r.error?.code, JSON.stringify(items).slice(0, 80)).toBe("23514");
    }
    // 50곡 × 긴 메모 → 64KB 초과
    const big = Array.from({ length: 50 }, () => item(sid, { note: "가".repeat(500), transition: "나".repeat(300) }));
    expect((await newSetlist(a, aId, big)).error?.code).toBe("23514");
    expect((await newSetlist(a, aId, [], { title: "a".repeat(101) })).error?.code).toBe("23514");
    expect((await newSetlist(a, aId, [], { memo: "a".repeat(1001) })).error?.code).toBe("23514");
    // 경계값은 허용
    const ok = await newSetlist(a, aId, [item(sid, { transpose: -24, bpm: 400, form: "a".repeat(200) })]);
    expect(ok.error).toBeNull();
  });

  it("#7 소유 확인(긍정형): 타인의 실제 scoreId·없는 uuid·uuid 아님·내 삭제 악보 → insert/update 거부", async () => {
    const mine = await newScore(a, aId);
    const theirs = await newScore(b, bId);
    const gone = await newScore(a, aId);
    const at = new Date().toISOString();
    expect((await a.from("scores").update({ deleted_at: at, updated_at: at }).eq("id", gone)).error).toBeNull();
    for (const sid of [theirs, randomUUID(), "not-a-uuid", gone]) {
      const ins = await newSetlist(a, aId, [item(mine), item(sid)]);
      expect(ins.error?.code, String(sid)).toBe("23514");
    }
    const sl = await newSetlist(a, aId, [item(mine)]);
    expect(sl.error).toBeNull();
    for (const sid of [theirs, randomUUID(), gone]) {
      const up = await a.from("setlists").update({ items: [item(sid)] }).eq("id", sl.data!.id).select("id");
      expect(up.error?.code, sid).toBe("23514");
    }
    // 타인 명의(user_id 위조) insert 도 RLS 로 거부
    expect((await newSetlist(b, aId, [])).error).not.toBeNull();
  });

  it("#8 anon 은 setlists 직접 select 불가, 타인도 0행", async () => {
    const sl = await newSetlist(a, aId, []);
    expect(sl.error).toBeNull();
    const sel = await anon.from("setlists").select("id");
    expect(sel.error !== null || (sel.data ?? []).length === 0).toBe(true);
    expect((await b.from("setlists").select("id").eq("id", sl.data!.id)).data ?? []).toHaveLength(0);
    const upd = await b.from("setlists").update({ title: "탈취" }).eq("id", sl.data!.id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("#9 get_shared_setlist: 노출 필드만, share_notes=false 면 memo·note·transition 없음", async () => {
    const s1 = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(s1, { transpose: 3, bpm: 90 })]);
    const { token, res } = await issue(a, aId, { setlist_id: sl.data!.id });
    expect(res.error).toBeNull();
    const got = await anon.rpc("get_shared_setlist", { p_token: token });
    expect(got.error).toBeNull();
    expect(got.data).toHaveLength(1);
    const row = got.data[0];
    expect(Object.keys(row).sort()).toEqual(["items", "memo", "scores", "service_date", "title"]);
    expect(row.memo).toBe("인도자 멘트");
    expect(row.items).toEqual([{ scoreId: s1, transpose: 3, bpm: 90, form: "전주-A-B", note: "곡 메모", transition: "전환 메모" }]);
    expect(row.scores).toHaveLength(1);
    expect(Object.keys(row.scores[0]).sort()).toEqual(["data", "id", "title"]);
    expect(JSON.stringify(row)).not.toContain(aId);

    expect((await a.from("setlists").update({ share_notes: false }).eq("id", sl.data!.id)).error).toBeNull();
    const hidden = (await anon.rpc("get_shared_setlist", { p_token: token })).data[0];
    expect(hidden.memo).toBeNull();
    expect(hidden.items).toEqual([{ scoreId: s1, transpose: 3, bpm: 90, form: "전주-A-B" }]);
    expect(JSON.stringify(hidden)).not.toContain("메모");
    expect(JSON.stringify(hidden)).not.toContain("share_notes");
  });

  it("#9 포함 악보: 이후 삭제된 악보는 scores 에서 빠진다(항목은 남음)", async () => {
    const s1 = await newScore(a, aId);
    const s2 = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(s1), item(s2)]);
    const { token } = await issue(a, aId, { setlist_id: sl.data!.id });
    const at = new Date().toISOString();
    await a.from("scores").update({ deleted_at: at, updated_at: at }).eq("id", s2);
    const row = (await anon.rpc("get_shared_setlist", { p_token: token })).data[0];
    expect(row.items).toHaveLength(2);
    expect(row.scores.map((s: { id: string }) => s.id)).toEqual([s1]);
  });

  it("#10 포함 악보 data 합계 1MB 초과 시 넘는 곡부터 빠지고 응답이 상한 이하", async () => {
    const pad = "x".repeat(400_000);
    const ids = [await newScore(a, aId, { pad }), await newScore(a, aId, { pad }), await newScore(a, aId, { pad })];
    const sl = await newSetlist(a, aId, ids.map((id) => item(id)));
    expect(sl.error).toBeNull();
    const { token } = await issue(a, aId, { setlist_id: sl.data!.id });
    const row = (await anon.rpc("get_shared_setlist", { p_token: token })).data[0];
    expect(row.scores.map((s: { id: string }) => s.id)).toEqual(ids.slice(0, 2));
    const dataBytes = row.scores.reduce((n: number, s: { data: unknown }) => n + Buffer.byteLength(JSON.stringify(s.data)), 0);
    expect(dataBytes).toBeLessThanOrEqual(1_048_576);
  }, 60_000);

  it("#11 회수·만료·콘티 삭제·잘못된 토큰이 같은 응답(0행), 삭제→복구 후에도 꺼진 채", async () => {
    const sid = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(sid)]);
    const { token } = await issue(a, aId, { setlist_id: sl.data!.id });
    expect((await anon.rpc("get_shared_setlist", { p_token: token })).data).toHaveLength(1);
    // 잘못된 토큰
    for (const t of ["short", generateShareToken(), ""]) {
      const r = await anon.rpc("get_shared_setlist", { p_token: t });
      expect(r.error).toBeNull();
      expect(r.data ?? []).toHaveLength(0);
    }
    // 삭제 → 링크 회수
    const at = new Date().toISOString();
    expect((await a.from("setlists").update({ deleted_at: at }).eq("id", sl.data!.id)).error).toBeNull();
    const link = await a.from("share_links").select("revoked_at").eq("setlist_id", sl.data!.id).single();
    expect(link.data?.revoked_at).not.toBeNull();
    expect((await anon.rpc("get_shared_setlist", { p_token: token })).data ?? []).toHaveLength(0);
    // 삭제된 콘티엔 발급 불가
    expect((await issue(a, aId, { setlist_id: sl.data!.id })).res.error).not.toBeNull();
    // 복구해도 꺼진 채
    expect((await a.from("setlists").update({ deleted_at: null }).eq("id", sl.data!.id)).error).toBeNull();
    expect((await anon.rpc("get_shared_setlist", { p_token: token })).data ?? []).toHaveLength(0);
    // 회수
    const sl2 = await newSetlist(a, aId, [item(sid)]);
    const t2 = await issue(a, aId, { setlist_id: sl2.data!.id });
    await a.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("setlist_id", sl2.data!.id);
    expect((await anon.rpc("get_shared_setlist", { p_token: t2.token })).data ?? []).toHaveLength(0);
    // 만료: 만료일이 지난 링크(관리자가 시각을 과거로 돌림 — insert 가드는 과거 만료일을 막으므로)
    const sl3 = await newSetlist(a, aId, [item(sid)]);
    const t3 = await issue(a, aId, { setlist_id: sl3.data!.id });
    const exp = await admin.from("share_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("setlist_id", sl3.data!.id).select("id");
    expect(exp.error).toBeNull();
    expect((await anon.rpc("get_shared_setlist", { p_token: t3.token })).data ?? []).toHaveLength(0);
  });

  it("#12 콘티 토큰으로 get_shared_score 0행, 악보 토큰으로 get_shared_setlist 0행", async () => {
    const sid = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(sid)]);
    const st = await issue(a, aId, { setlist_id: sl.data!.id });
    const sc = await issue(a, aId, { score_id: sid });
    expect(st.res.error).toBeNull();
    expect(sc.res.error).toBeNull();
    expect((await anon.rpc("get_shared_score", { p_token: st.token })).data ?? []).toHaveLength(0);
    expect((await anon.rpc("get_shared_setlist", { p_token: sc.token })).data ?? []).toHaveLength(0);
    expect((await anon.rpc("get_shared_score", { p_token: sc.token })).data).toHaveLength(1);
    expect((await anon.rpc("get_shared_setlist", { p_token: st.token })).data).toHaveLength(1);
  });

  it("공유 대상 제약: 둘 다·둘 다 없음 거부, 타인 콘티로 발급 거부, 콘티당 활성 링크 1개", async () => {
    const sid = await newScore(a, aId);
    const sl = await newSetlist(a, aId, [item(sid)]);
    expect((await issue(a, aId, { score_id: sid, setlist_id: sl.data!.id })).res.error).not.toBeNull();
    expect((await issue(a, aId, {})).res.error).not.toBeNull();
    expect((await issue(b, bId, { setlist_id: sl.data!.id })).res.error).not.toBeNull();
    expect((await issue(b, aId, { setlist_id: sl.data!.id })).res.error).not.toBeNull();
    expect((await issue(a, aId, { setlist_id: sl.data!.id })).res.error).toBeNull();
    expect((await issue(a, aId, { setlist_id: sl.data!.id })).res.error?.code).toBe("23505");
  });

  it("#13 회귀(V3): 콘티 링크가 있어도 악보 링크 목록 select·상태·회수·만료 정리가 전과 같다", async () => {
    const u = await makeUser("reg");
    try {
      const sid = await newScore(u.client, u.id);
      const sl = await newSetlist(u.client, u.id, [item(sid)]);
      expect((await issue(u.client, u.id, { setlist_id: sl.data!.id })).res.error).toBeNull();
      const sc = await issue(u.client, u.id, { score_id: sid });
      expect(sc.res.error).toBeNull();
      // listShareLinks 와 같은 select
      const list = await u.client
        .from("share_links")
        .select("score_id, setlist_id, expires_at, created_at, scores(title, deleted_at), setlists(title, deleted_at)")
        .eq("owner_id", u.id)
        .is("revoked_at", null);
      expect(list.error).toBeNull();
      expect(list.data).toHaveLength(2);
      const sRow = list.data!.find((r) => r.score_id === sid)!;
      const lRow = list.data!.find((r) => r.setlist_id === sl.data!.id)!;
      expect(sRow.setlists).toBeNull();
      expect(lRow.score_id).toBeNull();
      expect(lRow.setlists).toEqual({ title: "주일 1부", deleted_at: null });
      // getShareStatus(악보)
      const st = await u.client.from("share_links").select("expires_at").eq("score_id", sid).eq("owner_id", u.id).is("revoked_at", null).maybeSingle();
      expect(st.error).toBeNull();
      expect(st.data).not.toBeNull();
      // 만료 정리(악보 기준)는 콘티 링크를 건드리지 않는다
      const clean = await u.client.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("score_id", sid).is("revoked_at", null).lte("expires_at", new Date().toISOString()).select("id");
      expect(clean.error).toBeNull();
      // revokeShareLink(악보)는 악보 링크만 끈다
      const rev = await u.client.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("score_id", sid).eq("owner_id", u.id).is("revoked_at", null).select("id");
      expect(rev.data).toHaveLength(1);
      expect((await u.client.from("share_links").select("id").eq("setlist_id", sl.data!.id).is("revoked_at", null)).data).toHaveLength(1);
      // 재발급 RPC(악보 전용)도 그대로
      const re = await u.client.rpc("reissue_share_link", { p_score_id: sid, p_token_hash: hashShareToken(generateShareToken()) });
      expect(re.error).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(u.id);
    }
  });
});
