import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * 브라우저용 Supabase 클라이언트 (싱글톤). 세션은 쿠키로 서버와 공유됩니다.
 * 환경변수가 없거나 서버(SSR) 환경이면 null.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client !== undefined) return client;
  const env = getSupabaseEnv();
  client = env ? createBrowserClient(env.url, env.key) : null;
  return client;
}
