import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthMock } from "../auth-mock";
import { getSupabaseEnv } from "./env";

/**
 * 브라우저용 Supabase 클라이언트 (싱글톤). 세션은 쿠키로 서버와 공유됩니다.
 * 환경변수가 없거나 서버(SSR) 환경이거나 체험(mock) 로그인 모드면 null → 원격 동기화·서버 호출 없음.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined" || isAuthMock()) return null;
  if (client !== undefined) return client;
  const env = getSupabaseEnv();
  client = env ? createBrowserClient(env.url, env.key) : null;
  return client;
}
