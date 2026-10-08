import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 정적 export(앱 번들)에서는 서버가 없으므로 Supabase는 브라우저 클라이언트로만 사용합니다.
 * 보안은 키 은닉이 아니라 RLS(행 단위 보안)로 지킵니다 → supabase/migrations 참고.
 * 환경변수가 없으면 null 을 반환하고 앱은 로컬 저장 모드로 동작합니다.
 */
let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}
