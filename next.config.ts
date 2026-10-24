import type { NextConfig } from "next";

/**
 * HumScore — 풀스택 Next.js (Vercel)
 *
 * 서버 런타임 사용: Server Components · Server Actions · Route Handlers · 쿠키 인증(Supabase SSR).
 * 모바일 앱(Capacitor)은 운영 도메인을 원격 로드합니다 → capacitor.config.ts 의 server.url.
 */
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 보안 패치가 나오면 next dev 가 에이전트에게 업그레이드를 안내
    agentUpgrade: "security",
  },
  async redirects() {
    // 정적 export 시절 쿼리 기반 URL(/score/?id=…) → 동적 세그먼트
    return [
      {
        source: "/score",
        has: [{ type: "query", key: "id", value: "(?<id>.+)" }],
        destination: "/scores/:id",
        permanent: true,
      },
      {
        source: "/perform",
        has: [{ type: "query", key: "id", value: "(?<id>.+)" }],
        destination: "/scores/:id/perform",
        permanent: true,
      },
    ];
  },
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
