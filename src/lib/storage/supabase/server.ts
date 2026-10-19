import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * 서버(Server Action · Route Handler)용 Supabase 클라이언트.
 * 요청마다 새로 만들어야 합니다(전역 캐시 금지). 환경변수가 없으면 null.
 */
export async function createSupabaseServer(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component 에서 호출된 경우 쓰기 불가 — proxy 가 세션을 갱신하므로 무시
        }
      },
    },
  });
}
