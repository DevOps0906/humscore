import type { MetadataRoute } from "next";

// 공유 링크는 검색 노출 금지 (보조 수단 — 실제 차단은 src/proxy.ts 의 X-Robots-Tag)
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/s/" } };
}
