/** 공유 링크 열람 경로(/s/…) 응답에 붙이는 보안 헤더. src/proxy.ts 에서 사용 */
export const SHARE_PATH_PREFIX = "/s/";

export const SHARE_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export function isSharePath(pathname: string): boolean {
  return pathname.startsWith(SHARE_PATH_PREFIX);
}

export function applyShareHeaders(pathname: string, headers: Headers): void {
  if (!isSharePath(pathname)) return;
  for (const [k, v] of Object.entries(SHARE_RESPONSE_HEADERS)) headers.set(k, v);
}
