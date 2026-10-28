"use server";

import type { Score } from "@/lib/music/types";
import type { CloudTombstone } from "@/lib/storage/merge";
import { MAX_SCORE_BYTES, parseScore, scoreBytes, scoreIdSchema, scoreSchema } from "@/lib/storage/score-schema";
import { createSupabaseServer } from "@/lib/storage/supabase/server";

export type ActionError = "disabled" | "unauthenticated" | "mismatch" | "stale" | "invalid" | "failed";
// mismatch: 요청을 시작한 계정(expectedUserId)과 현재 쿠키 계정이 다름 / stale: DB LWW 가드가 더 오래된 버전이라 반영하지 않음
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

const FUTURE_SKEW_MS = 5 * 60 * 1000;

async function authed() {
  const sb = await createSupabaseServer();
  if (!sb) return { ok: false as const, error: "disabled" as const };
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: "unauthenticated" as const };
  return { ok: true as const, sb, userId: data.user.id };
}

/**
 * 내 악보 + 삭제 기록(RLS 로 본인 것만). 버전은 행의 updated_at 을 사용합니다(서버 보정/LWW 결과와 일치).
 * 스키마를 통과하지 못하는 행은 건너뜁니다.
 */
export async function listScores(): Promise<ActionResult<{ userId: string; scores: Score[]; tombstones: CloudTombstone[] }>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("scores")
      .select("id, data, updated_at, deleted_at")
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (error) return { ok: false, error: "failed" };
    const scores: Score[] = [];
    const tombstones: CloudTombstone[] = [];
    for (const r of data ?? []) {
      const updatedAt = new Date(r.updated_at as string).toISOString();
      if (r.deleted_at) {
        tombstones.push({ id: r.id as string, updatedAt, deletedAt: new Date(r.deleted_at as string).toISOString() });
        continue;
      }
      const s = parseScore(r.data);
      if (s) scores.push({ ...s, updatedAt });
    }
    return { ok: true, data: { userId: a.userId, scores, tombstones } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function saveScore(input: unknown, expectedUserId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = scoreSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid" };
    let score = parsed.data as Score;
    if (scoreBytes(score) > MAX_SCORE_BYTES) return { ok: false, error: "invalid" };
    const now = Date.now();
    if (Date.parse(score.updatedAt) > now + FUTURE_SKEW_MS) score = { ...score, updatedAt: new Date(now).toISOString() };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    if (a.userId !== expectedUserId) return { ok: false, error: "mismatch" };
    const { data: rows, error } = await a.sb.from("scores").upsert({
      id: score.id,
      user_id: a.userId,
      title: score.title,
      data: score,
      created_at: score.createdAt,
      updated_at: score.updatedAt,
      deleted_at: null, // 삭제 후 다시 수정된 악보는 되살림
    }).select("id");
    if (error) return { ok: false, error: error.code === "53400" ? "invalid" : "failed" };
    if (!rows || rows.length === 0) return { ok: false, error: "stale" }; // LWW 트리거가 건너뜀 — 조용한 ok 금지
    return { ok: true, data: { id: score.id } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 소프트 삭제: deleted_at 과 updated_at 을 함께 올린다(LWW 가드를 통과하도록 기존 값보다 항상 큼). */
export async function deleteScore(id: unknown, expectedUserId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = scoreIdSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    if (a.userId !== expectedUserId) return { ok: false, error: "mismatch" };
    const { data: row, error: readErr } = await a.sb.from("scores").select("updated_at").eq("id", parsed.data).maybeSingle();
    if (readErr) return { ok: false, error: "failed" };
    if (!row) return { ok: true, data: { id: parsed.data } }; // 클라우드에 없음 — 할 일 없음
    const at = new Date(Math.max(Date.now(), Date.parse(row.updated_at as string) + 1)).toISOString();
    const { error } = await a.sb
      .from("scores")
      .update({ deleted_at: at, updated_at: at })
      .eq("id", parsed.data)
      .eq("user_id", a.userId);
    if (error) return { ok: false, error: "failed" };
    return { ok: true, data: { id: parsed.data } };
  } catch {
    return { ok: false, error: "failed" };
  }
}
