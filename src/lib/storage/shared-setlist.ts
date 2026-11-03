import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Score } from "../music/types";
import { parseScore } from "./score-schema";
import { setlistItemSchema, type SetlistItem } from "./setlist-schema";
import { shareTokenSchema } from "./share-token";
import { getSupabaseEnv } from "./supabase/env";

export type SharedSetlist = {
  title: string;
  serviceDate: string;
  memo: string | null;
  items: SetlistItem[];
  scores: Score[];
};

/** RPC 응답은 노출 필드만 허용하고, 포함 악보는 기존 Score 스키마로 다시 검증한다. */
export function parseSharedSetlist(input: unknown): SharedSetlist | null {
  if (input === null || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const serviceDate = z.iso.date().safeParse(row.service_date);
  if (
    typeof row.title !== "string" ||
    !serviceDate.success ||
    (row.memo !== null && typeof row.memo !== "string") ||
    !Array.isArray(row.items) ||
    row.items.length > 50 ||
    !Array.isArray(row.scores) ||
    row.scores.length > 50
  ) return null;

  const parsedItems = row.items.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const value = item as Record<string, unknown>;
    return setlistItemSchema.safeParse({
      ...value,
      note: value.note ?? null,
      transition: value.transition ?? null,
    });
  });
  if (parsedItems.some((item) => !item?.success)) return null;

  const scores: Score[] = [];
  for (const value of row.scores) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const scoreRow = value as Record<string, unknown>;
    if (typeof scoreRow.id !== "string" || typeof scoreRow.title !== "string") return null;
    const score = parseScore(scoreRow.data);
    if (!score || score.id !== scoreRow.id) return null;
    scores.push(score);
  }

  return {
    title: row.title,
    serviceDate: serviceDate.data,
    memo: row.memo,
    items: parsedItems.flatMap((item) => item?.success ? [item.data] : []),
    scores,
  };
}

/**
 * 콘티 공유는 anon 키와 get_shared_setlist RPC만 사용한다.
 * 토큰·본문은 로그에 남기지 않고, 무효 링크·스키마 오류는 동일하게 숨긴다.
 */
export async function fetchSharedSetlist(token: string): Promise<SharedSetlist | null> {
  try {
    if (!shareTokenSchema.safeParse(token).success) return null;
    const env = getSupabaseEnv();
    if (!env) return null;
    const sb = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.rpc("get_shared_setlist", { p_token: token });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return parseSharedSetlist(data[0]);
  } catch {
    return null;
  }
}
