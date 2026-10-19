import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/storage/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    {
      // 정적 자산·이미지·PWA 파일 제외 (점은 모두 이스케이프)
      source:
        "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?|json)$).*)",
      // 링크 프리페치 요청에서는 세션 갱신을 건너뜀
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
