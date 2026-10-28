import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthMock, isMockSignedIn, setMockSignedIn, subscribeMockAuth } from "../auth-mock";
import { getSupabase } from "../supabase/client";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("window", { addEventListener: () => {}, removeEventListener: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("auth-mock", () => {
  it("플래그가 없으면 기본 켜짐, \"0\"이면 꺼짐", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "");
    expect(isAuthMock()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "1");
    expect(isAuthMock()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "0");
    expect(isAuthMock()).toBe(false);
  });

  it("기본은 로그인 상태, 로그아웃→재로그인을 구독자에게 알림", () => {
    const seen: boolean[] = [];
    const off = subscribeMockAuth(() => seen.push(isMockSignedIn()));
    expect(isMockSignedIn()).toBe(true);
    setMockSignedIn(false);
    setMockSignedIn(true);
    off();
    setMockSignedIn(false);
    expect(seen).toEqual([false, true]);
  });

  it("mock 모드에서는 Supabase 클라이언트를 만들지 않음(원격 호출 없음)", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test");
    expect(getSupabase()).toBeNull();
  });
});
