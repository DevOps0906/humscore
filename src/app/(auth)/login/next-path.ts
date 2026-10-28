/**
 * 로그인 후 이동할 경로. ?next 를 현재 origin 기준으로 파싱해 같은 origin 일 때만 허용하고,
 * 결과는 pathname+search+hash 만 돌려준다 (\·탭·// 등 오픈 리다이렉트 우회 차단). 아니면 /library.
 */
export function safeNextPath(next: string | null, origin: string): string {
  const fallback = "/library";
  if (!next) return fallback;
  try {
    const u = new URL(next, origin);
    if (u.origin !== origin || !u.pathname.startsWith("/")) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
