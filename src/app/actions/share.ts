"use server";

import { z } from "zod";
import { scoreIdSchema } from "@/lib/storage/score-schema";
import { checkShareExpiry, generateShareToken, hashShareToken, sharePath } from "@/lib/storage/share-token";
import { createSupabaseServer } from "@/lib/storage/supabase/server";

// unsynced: 서버에 악보가 없음 / stale: 클라이언트 updatedAt 과 서버 updated_at 불일치 / limit: 활성 링크 상한
export type ShareError = "disabled" | "unauthenticated" | "invalid" | "unsynced" | "stale" | "limit" | "failed";
export type ShareResult<T> = { ok: true; data: T } | { ok: false; error: ShareError };

const isoSchema = z.iso.datetime({ offset: true });

async function authed() {
  const sb = await createSupabaseServer();
  if (!sb) return { ok: false as const, error: "disabled" as const };
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: "unauthenticated" as const };
  return { ok: true as const, sb, userId: data.user.id };
}

type Authed = Extract<Awaited<ReturnType<typeof authed>>, { ok: true }>;

/** 공통 사전 검사: 입력 형식·만료일, 서버 행 존재(삭제 아님)와 updatedAt 일치. 통과하면 새 토큰·해시를 돌려준다. */
async function prepare(a: Authed, scoreId: unknown, updatedAt: unknown, expiresAt: unknown) {
  const id = scoreIdSchema.safeParse(scoreId);
  const ver = isoSchema.safeParse(updatedAt);
  if (!id.success || !ver.success) return { ok: false as const, error: "invalid" as const };
  let expires: string | null = null;
  if (expiresAt !== undefined && expiresAt !== null) {
    const e = isoSchema.safeParse(expiresAt);
    expires = e.success ? checkShareExpiry(e.data) : null;
    if (!expires) return { ok: false as const, error: "invalid" as const };
  }
  const { data: row, error } = await a.sb
    .from("scores")
    .select("updated_at, deleted_at")
    .eq("id", id.data)
    .eq("user_id", a.userId)
    .maybeSingle();
  if (error) return { ok: false as const, error: "failed" as const };
  if (!row || row.deleted_at) return { ok: false as const, error: "unsynced" as const };
  if (Date.parse(row.updated_at as string) !== Date.parse(ver.data)) return { ok: false as const, error: "stale" as const };
  const token = generateShareToken();
  return { ok: true as const, scoreId: id.data, expires, token, hash: hashShareToken(token) };
}

function mapDbError(code: string | undefined): ShareError {
  if (code === "53400") return "limit";
  if (code === "22023" || code === "23514") return "invalid";
  if (code === "42501" || code === "23503") return "unsynced"; // RLS with check 거부(타인·삭제 악보) / FK
  return "failed";
}

export type CreateShareData = { state: "created"; path: string; expiresAt: string | null } | { state: "already" };

/** 링크 켜기. 원문 토큰은 이 응답(path)에서만 1회 돌려준다. 이미 켜져 있으면 state "already". */
export async function createShareLink(scoreId: unknown, updatedAt: unknown, expiresAt?: unknown): Promise<ShareResult<CreateShareData>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const p = await prepare(a, scoreId, updatedAt, expiresAt);
    if (!p.ok) return { ok: false, error: p.error };
    // 만료됐지만 아직 회수되지 않은 링크는 부분 유니크 인덱스를 막으므로 먼저 정리
    await a.sb
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("score_id", p.scoreId)
      .is("revoked_at", null)
      .lte("expires_at", new Date().toISOString());
    const { error } = await a.sb
      .from("share_links")
      .insert({ score_id: p.scoreId, owner_id: a.userId, token_hash: p.hash, expires_at: p.expires });
    if (error) {
      if (error.code === "23505") return { ok: true, data: { state: "already" } }; // 동시 클릭 — 오류가 아님
      return { ok: false, error: mapDbError(error.code) };
    }
    return { ok: true, data: { state: "created", path: sharePath(p.token), expiresAt: p.expires } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 재발급: 기존 링크를 끄고 새 토큰을 한 트랜잭션(RPC)에서 발급. 실패하면 기존 링크 유지. */
export async function reissueShareLink(scoreId: unknown, updatedAt: unknown, expiresAt?: unknown): Promise<ShareResult<{ path: string; expiresAt: string | null }>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const p = await prepare(a, scoreId, updatedAt, expiresAt);
    if (!p.ok) return { ok: false, error: p.error };
    const { error } = await a.sb.rpc("reissue_share_link", {
      p_score_id: p.scoreId,
      p_token_hash: p.hash,
      p_expires_at: p.expires,
    });
    if (error) return { ok: false, error: mapDbError(error.code) };
    return { ok: true, data: { path: sharePath(p.token), expiresAt: p.expires } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 링크 끄기(멱등): 없거나 이미 꺼져 있어도 ok */
export async function revokeShareLink(scoreId: unknown): Promise<ShareResult<null>> {
  try {
    const id = scoreIdSchema.safeParse(scoreId);
    if (!id.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { error } = await a.sb
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("score_id", id.data)
      .eq("owner_id", a.userId)
      .is("revoked_at", null);
    if (error) return { ok: false, error: "failed" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 공유 상태(토큰 없음): 활성(회수·만료 아님) 여부와 만료일 */
export async function getShareStatus(scoreId: unknown): Promise<ShareResult<{ active: boolean; expiresAt: string | null }>> {
  try {
    const id = scoreIdSchema.safeParse(scoreId);
    if (!id.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("share_links")
      .select("expires_at")
      .eq("score_id", id.data)
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
