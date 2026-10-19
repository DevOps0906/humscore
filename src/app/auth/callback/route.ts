import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/storage/supabase/server";

/** 매직링크/OAuth 복귀 지점: code → 세션 쿠키 교환 후 /library 로 이동 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServer();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}/library`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
