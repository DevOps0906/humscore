import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/** 요청마다 Supabase 세션 쿠키를 갱신합니다. 환경변수가 없으면 그대로 통과. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // 인증 응답이 CDN 에 캐시되지 않도록 Supabase 가 주는 캐시 헤더를 그대로 전달
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  try {
    // getClaims(): JWT 서명 검증 + 만료 임박 시 토큰 갱신(쿠키 재설정)
    await supabase.auth.getClaims();
  } catch {
    /* 네트워크 오류 등 — 요청은 그대로 진행 */
  }
  return response;
}
