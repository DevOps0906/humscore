import type { NextConfig } from "next";

/**
 * HumScore — Next.js + Capacitor 구성
 *
 * output: "export"  → `next build` 결과가 `out/` 정적 파일로 생성되고,
 *                     Capacitor가 이 폴더(webDir)를 앱 안에 번들합니다.
 * 앱 내부에는 Node 서버가 없으므로 Server Actions·Route Handlers(동적)·
 * Proxy·Rewrites·쿠키는 사용하지 않습니다. 서버 로직은 Supabase로 분리합니다.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // /record → /record/index.html (Capacitor 파일 서빙과 궁합)
  images: { unoptimized: true },
  // cacheComponents / partialPrefetching(PPR)은 서버 런타임 기능이라 export 모드와 함께 쓸 수 없음
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
