/**
 * 체험(mock) 로그인 — 실제 로그인 작업 전까지 기본으로 켜짐.
 * NEXT_PUBLIC_AUTH_MOCK=0 이면 꺼지고 기존 Supabase 로그인·동기화가 그대로 동작합니다.
 * mock 세션은 이 브라우저의 표시 상태일 뿐 — 서버 권한·토큰이 없으므로 원격 동기화·서버 호출을 하지 않습니다.
 */

export const MOCK_USER = { id: "mock-user", name: "체험 사용자", email: "mock@humscore.local" } as const;

const SIGNED_OUT_KEY = "humscore.authMock.signedOut";
const listeners = new Set<() => void>();
let memorySignedIn = true; // localStorage 를 못 쓸 때 같은 탭에서라도 상태를 유지

export function isAuthMock(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MOCK !== "0";
}

/** mock 세션이 켜져 있는지 (로그아웃 플래그가 없으면 켜짐) */
export function isMockSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_OUT_KEY) !== "1";
  } catch {
    return memorySignedIn;
  }
}

export function setMockSignedIn(on: boolean) {
  memorySignedIn = on;
  try {
    if (on) localStorage.removeItem(SIGNED_OUT_KEY);
    else localStorage.setItem(SIGNED_OUT_KEY, "1");
  } catch {
    /* 저장 불가 — 무시 */
  }
  listeners.forEach((l) => l());
}

export function subscribeMockAuth(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === SIGNED_OUT_KEY && listener();
  window.addEventListener("storage", onStorage); // 다른 탭
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
