import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 로컬 Supabase 통합 테스트 (RLS · LWW 트리거 · 시각 보정 · 2000개 제한).
 * 실행: npm run db:start 후 상태 출력의 값을 환경변수로 전달
 *   SUPABASE_INTEGRATION=1 SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm test
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

describe.skipIf(!run)("scores 서버 계약 (로컬 Supabase)", () => {
  let admin: SupabaseClient;
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aId = "";
  let bId = "";
  const password = "Test-pass-1234!";
  const stamp = Date.now();

  async function makeUser(tag: string) {
    const email = `it-${tag}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser 실패");
    const client = createClient(url, anonKey, opts);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password });
    if (e2) throw e2;
    return { id: data.user.id, client };
  }

  const row = (userId: string, id: string, updatedAt: string, title = "t") => ({
    id,
    user_id: userId,
    title,
    data: { id, title },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: updatedAt,
    deleted_at: null,
  });

  beforeAll(async () => {
    admin = createClient(url, serviceKey, opts);
    const ua = await makeUser("a");
    const ub = await makeUser("b");
    a = ua.client;
    b = ub.client;
    aId = ua.id;
    bId = ub.id;
  }, 60_000);

  afterAll(async () => {
    if (aId) await admin.auth.admin.deleteUser(aId); // scores 는 on delete cascade
    if (bId) await admin.auth.admin.deleteUser(bId);
  }, 60_000);

  it("정상: 본인 행 upsert 후 조회, 더 새로운 updated_at 은 반영", async () => {
    const id = randomUUID();
    const t1 = "2026-03-01T00:00:00.000Z";
    const t2 = "2026-03-02T00:00:00.000Z";
    const first = await a.from("scores").upsert(row(aId, id, t1, "v1")).select("id");
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    const second = await a.from("scores").upsert(row(aId, id, t2, "v2")).select("id");
    expect(second.error).toBeNull();
    expect(second.data).toHaveLength(1);
    const got = await a.from("scores").select("title, updated_at").eq("id", id).single();
    expect(got.data?.title).toBe("v2");
    expect(new Date(got.data!.updated_at).toISOString()).toBe(t2);
  });

  it("LWW: 더 오래된 updated_at upsert 는 0행 반환(stale)이고 행은 불변", async () => {
    const id = randomUUID();
    const t = "2026-04-10T00:00:00.000Z";
    await a.from("scores").upsert(row(aId, id, t, "keep")).select("id");
    const stale = await a.from("scores").upsert(row(aId, id, "2026-04-09T00:00:00.000Z", "old")).select("id");
    expect(stale.error).toBeNull();
    expect(stale.data).toHaveLength(0);
    const same = await a.from("scores").upsert(row(aId, id, t, "same")).select("id");
    expect(same.data).toHaveLength(0); // 같은 시각도 건너뜀
    const got = await a.from("scores").select("title, updated_at").eq("id", id).single();
    expect(got.data?.title).toBe("keep");
    expect(new Date(got.data!.updated_at).toISOString()).toBe(t);
  });

  it("RLS: B 는 A 의 행을 조회·수정·삭제할 수 없다", async () => {
    const id = randomUUID();
    await a.from("scores").upsert(row(aId, id, "2026-05-01T00:00:00.000Z", "mine")).select("id");

    const sel = await b.from("scores").select("id").eq("id", id);
    expect(sel.data ?? []).toHaveLength(0);

    const upd = await b.from("scores").update({ title: "hacked", updated_at: "2026-06-01T00:00:00.000Z" }).eq("id", id).select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const del = await b.from("scores").delete().eq("id", id).select("id");
    expect(del.data ?? []).toHaveLength(0);

    const got = await a.from("scores").select("title, deleted_at").eq("id", id).single();
    expect(got.data?.title).toBe("mine");
    expect(got.data?.deleted_at).toBeNull();
  });

  it("RLS: B 가 A 의 id 로 upsert 하면 오류이고 A 행은 불변", async () => {
    const id = randomUUID();
    const t = "2026-05-05T00:00:00.000Z";
    await a.from("scores").upsert(row(aId, id, t, "mine")).select("id");
    // B 명의로 A 의 id 에 쓰기
    const asB = await b.from("scores").upsert(row(bId, id, "2026-06-05T00:00:00.000Z", "hijack")).select("id");
    expect(asB.error).not.toBeNull();
    // user_id 를 A 로 위조
    const forged = await b.from("scores").upsert(row(aId, id, "2026-06-06T00:00:00.000Z", "forged")).select("id");
    expect(forged.error).not.toBeNull();
    const got = await a.from("scores").select("title, user_id, updated_at").eq("id", id).single();
    expect(got.data?.title).toBe("mine");
    expect(got.data?.user_id).toBe(aId);
    expect(new Date(got.data!.updated_at).toISOString()).toBe(t);
  });

  it("보정: 5분 넘게 미래인 updated_at 은 서버 now() 로 당겨진다", async () => {
    const id = randomUUID();
    const before = Date.now();
    const future = new Date(before + 24 * 3600 * 1000).toISOString();
    const r = await a.from("scores").upsert(row(aId, id, future)).select("id, updated_at");
    expect(r.error).toBeNull();
    const at = Date.parse(r.data![0].updated_at);
    expect(at).toBeLessThan(before + 5 * 60 * 1000);
    expect(at).toBeGreaterThan(before - 60 * 1000);
  });

  it("소프트 삭제: deleted_at 과 updated_at 을 올리면 반영되고 updated_at 이 증가", async () => {
    const id = randomUUID();
    const t = "2026-07-01T00:00:00.000Z";
    await a.from("scores").upsert(row(aId, id, t)).select("id");
    const at = new Date(Date.now()).toISOString();
    const del = await a.from("scores").update({ deleted_at: at, updated_at: at }).eq("id", id).eq("user_id", aId).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    const got = await a.from("scores").select("updated_at, deleted_at").eq("id", id).single();
    expect(Date.parse(got.data!.updated_at)).toBeGreaterThan(Date.parse(t));
    expect(got.data?.deleted_at).not.toBeNull();
    // 삭제 시각보다 오래된 되살리기 시도는 무시(stale)
    const revive = await a.from("scores").upsert({ ...row(aId, id, t), deleted_at: null }).select("id");
    expect(revive.data).toHaveLength(0);
  });

  it("제한: 살아있는 악보 2000개에서 새 행 insert 는 53400, 기존 행 갱신은 허용", async () => {
    const ub = await makeUser("cap");
    try {
      const rows = Array.from({ length: 2000 }, () => row(ub.id, randomUUID(), "2026-08-01T00:00:00.000Z"));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from("scores").insert(rows.slice(i, i + 500));
        expect(error).toBeNull();
      }
      const over = await ub.client.from("scores").insert(row(ub.id, randomUUID(), "2026-08-02T00:00:00.000Z"));
      expect(over.error?.code).toBe("53400");
      const upd = await ub.client
        .from("scores")
        .upsert(row(ub.id, rows[0].id, "2026-08-03T00:00:00.000Z", "edited"))
        .select("id");
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(1);
    } finally {
      await admin.auth.admin.deleteUser(ub.id);
    }
  }, 120_000);
});
