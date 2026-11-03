import { createClient } from "@supabase/supabase-js";
import type { Score } from "../music/types";
import { parseScore } from "./score-schema";
import { shareTokenSchema } from "./share-token";
import { getSupabaseEnv } from "./supabase/env";

/**
 * 공유 링크로 악보 1개를 읽는다(서버 전용). anon 키 + RPC get_shared_score 만 사용 — 쿠키·service_role 없음.
 * 형식 오류·없음·만료·회수·삭제·스키마 불일치·네트워크 오류 모두 null (호출자는 구분하지 않는다).
 * 토큰·본문을 로그에 남기지 않는다.
 */
export async function fetchSharedScore(token: string): Promise<Score | null> {
  try {
    if (!shareTokenSchema.safeParse(token).success) return null;
    const env = getSupabaseEnv();
    if (!env) return null;
    const sb = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.rpc("get_shared_score", { p_token: token });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return parseScore((data[0] as { data: unknown }).data);
  } catch {
    return null;
  }
}
