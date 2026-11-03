"use server";

import { z } from "zod";
import { scoreIdSchema } from "@/lib/storage/score-schema";
import { checkShareExpiry, generateShareToken, hashShareToken, sharePath } from "@/lib/storage/share-token";
import { createSupabaseServer } from "@/lib/storage/supabase/server";

// unsynced: 서버에 악보가 없음 / stale: 클라이언트 updatedAt 과 서버 updated_at 불일치 / limit: 활성 링크 상한
export type ShareError = "disabled" | "unauthenticated" | "invalid" | "unsynced" | "stale" | "limit" | "failed";
export type ShareResult<T> = { ok: true; data: T } | { ok: false; error: ShareError };

const isoSchema = z.iso.datetime({ offset: true });

/** 공유 대상: 악보 또는 콘티. 문자열 하나는 기존 호출(악보 id)과의 호환용. */
export type ShareTarget = { kind: "score" | "setlist"; id: string };
const targetSchema = z.union([
  scoreIdSchema.transform((id): ShareTarget => ({ kind: "score", id })),
  z.strictObject({ kind: z.enum(["score", "setlist"]), id: z.uuid() }),
]);
const TARGET = {
  score: { table: "scores", column: "score_id" },
  setlist: { table: "setlists", column: "setlist_id" },
} as const;

async function authed() {
  const sb = await createSupabaseServer();
  if (!sb) return { ok: false as const, error: "disabled" as const };
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: "unauthenticated" as const };
  return { ok: true as const, sb, userId: data.user.id };
}

type Authed = Extract<Awaited<ReturnType<typeof authed>>, { ok: true }>;

/** 공통 사전 검사: 입력 형식·만료일, 서버 행 존재(삭제 아님)와 updatedAt 일치. 통과하면 새 토큰·해시를 돌려준다. */
async function prepare(a: Authed, target: unknown, updatedAt: unknown, expiresAt: unknown) {
  const id = targetSchema.safeParse(target);
  const ver = isoSchema.safeParse(updatedAt);
  if (!id.success || !ver.success) return { ok: false as const, error: "invalid" as const };
  let expires: string | null = null;
  if (expiresAt !== undefined && expiresAt !== null) {
    const e = isoSchema.safeParse(expiresAt);
    expires = e.success ? checkShareExpiry(e.data) : null;
    if (!expires) return { ok: false as const, error: "invalid" as const };
  }
  const { data: row, error } = await a.sb
    .from(TARGET[id.data.kind].table)
    .select("updated_at, deleted_at")
    .eq("id", id.data.id)
    .eq("user_id", a.userId)
    .maybeSingle();
  if (error) return { ok: false as const, error: "failed" as const };
  if (!row || row.deleted_at) return { ok: false as const, error: "unsynced" as const };
  if (Date.parse(row.updated_at as string) !== Date.parse(ver.data)) return { ok: false as const, error: "stale" as const };
  const token = generateShareToken();
  return { ok: true as const, target: id.data, expires, token, hash: hashShareToken(token) };
}

function mapDbError(code: string | undefined): ShareError {
  if (code === "53400") return "limit";
  if (code === "22023" || code === "23514") return "invalid";
  if (code === "42501" || code === "23503") return "unsynced"; // RLS with check 거부(타인·삭제 악보) / FK
  return "failed";
}

export type CreateShareData = { state: "created"; path: string; expiresAt: string | null } | { state: "already" };

/** 링크 켜기(대상: 악보 id 문자열 또는 {kind, id}). 원문 토큰은 이 응답(path)에서만 1회 돌려준다. 이미 켜져 있으면 state "already". */
export async function createShareLink(target: unknown, updatedAt: unknown, expiresAt?: unknown): Promise<ShareResult<CreateShareData>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const p = await prepare(a, target, updatedAt, expiresAt);
    if (!p.ok) return { ok: false, error: p.error };
    const column = TARGET[p.target.kind].column;
    // 만료됐지만 아직 회수되지 않은 링크는 부분 유니크 인덱스를 막으므로 먼저 정리
    await a.sb
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq(column, p.target.id)
      .is("revoked_at", null)
      .lte("expires_at", new Date().toISOString());
    const { error } = await a.sb
      .from("share_links")
      .insert({ [column]: p.target.id, owner_id: a.userId, token_hash: p.hash, expires_at: p.expires });
    if (error) {
      if (error.code === "23505") return { ok: true, data: { state: "already" } }; // 동시 클릭 — 오류가 아님
      return { ok: false, error: mapDbError(error.code) };
    }
    return { ok: true, data: { state: "created", path: sharePath(p.token), expiresAt: p.expires } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 재발급(악보 전용): 기존 링크를 끄고 새 토큰을 한 트랜잭션(RPC)에서 발급. 실패하면 기존 링크 유지. */
export async function reissueShareLink(scoreId: unknown, updatedAt: unknown, expiresAt?: unknown): Promise<ShareResult<{ path: string; expiresAt: string | null }>> {
  try {
    if (!scoreIdSchema.safeParse(scoreId).success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const p = await prepare(a, scoreId, updatedAt, expiresAt);
    if (!p.ok) return { ok: false, error: p.error };
    const { error } = await a.sb.rpc("reissue_share_link", {
      p_score_id: p.target.id,
      p_token_hash: p.hash,
      p_expires_at: p.expires,
    });
    if (error) return { ok: false, error: mapDbError(error.code) };
    return { ok: true, data: { path: sharePath(p.token), expiresAt: p.expires } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 링크 끄기(멱등, 대상: 악보 id 문자열 또는 {kind, id}): 없거나 이미 꺼져 있어도 ok */
export async function revokeShareLink(target: unknown): Promise<ShareResult<null>> {
  try {
    const id = targetSchema.safeParse(target);
    if (!id.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { error } = await a.sb
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq(TARGET[id.data.kind].column, id.data.id)
      .eq("owner_id", a.userId)
      .is("revoked_at", null);
    if (error) return { ok: false, error: "failed" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 공유 상태(토큰 없음, 대상: 악보 id 문자열 또는 {kind, id}): 활성(회수·만료 아님) 여부와 만료일 */
export async function getShareStatus(target: unknown): Promise<ShareResult<{ active: boolean; expiresAt: string | null }>> {
  try {
    const id = targetSchema.safeParse(target);
    if (!id.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("share_links")
      .select("expires_at")
      .eq(TARGET[id.data.kind].column, id.data.id)
      .eq("owner_id", a.userId)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: "failed" };
    const exp = (data?.expires_at as string | null | undefined) ?? null;
    const active = !!data && (exp === null || Date.parse(exp) > Date.now());
    return { ok: true, data: { active, expiresAt: active ? exp : null } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export type ShareLinkItem = { kind: ShareTarget["kind"]; id: string; title: string; expiresAt: string | null; createdAt: string };

const targetRowSchema = z.object({ title: z.string(), deleted_at: z.string().nullable() }).nullable();
const listRowSchema = z.object({
  score_id: z.uuid().nullable(),
  setlist_id: z.uuid().nullable(),
  expires_at: isoSchema.nullable(),
  created_at: isoSchema,
  scores: targetRowSchema,
  setlists: targetRowSchema,
});

/** 내 활성(회수·만료·삭제 아님) 공유 링크 목록(악보·콘티) — 토큰·해시는 돌려주지 않는다. 최근 만든 순. */
export async function listShareLinks(): Promise<ShareResult<ShareLinkItem[]>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("share_links")
      .select("score_id, setlist_id, expires_at, created_at, scores(title, deleted_at), setlists(title, deleted_at)")
      .eq("owner_id", a.userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false, error: "failed" };
    const rows = z.array(listRowSchema).safeParse(data ?? []);
    if (!rows.success) return { ok: false, error: "failed" };
    const now = Date.now();
    const items: ShareLinkItem[] = [];
    for (const r of rows.data) {
      if (r.expires_at !== null && Date.parse(r.expires_at) <= now) continue;
      const t = r.score_id ? { kind: "score" as const, id: r.score_id, row: r.scores } : { kind: "setlist" as const, id: r.setlist_id, row: r.setlists };
      if (!t.id || !t.row || t.row.deleted_at) continue;
      items.push({ kind: t.kind, id: t.id, title: t.row.title, expiresAt: r.expires_at, createdAt: r.created_at });
    }
    return { ok: true, data: items };
  } catch {
    return { ok: false, error: "failed" };
  }
}
