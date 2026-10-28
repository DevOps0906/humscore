"use client";

import { useSyncExternalStore } from "react";
import { MOCK_USER, isAuthMock, isMockSignedIn, subscribeMockAuth } from "@/lib/storage/auth-mock";
import { getSupabase } from "@/lib/storage/supabase/client";

export type AuthState =
  | { status: "loading" }
  | { status: "disabled" } // Supabase 환경변수 없음 → 로컬 모드
  | { status: "signed-out" }
  | { status: "signed-in"; email: string; mock?: { id: string; name: string } }; // mock = 체험 로그인(서버 세션 없음)

const LOADING: AuthState = { status: "loading" };
const DISABLED: AuthState = { status: "disabled" };
const SIGNED_OUT: AuthState = { status: "signed-out" };
const MOCK_SIGNED_IN: AuthState = { status: "signed-in", email: MOCK_USER.email, mock: { id: MOCK_USER.id, name: MOCK_USER.name } };

let snapshot: AuthState = LOADING;

function subscribe(onChange: () => void): () => void {
  if (isAuthMock()) {
    // 구독자마다 알린다 — snapshot 이 같으면 React 가 다시 그리지 않음
    const update = () => {
      snapshot = isMockSignedIn() ? MOCK_SIGNED_IN : SIGNED_OUT;
      onChange();
    };
    update();
    return subscribeMockAuth(update);
  }
  const sb = getSupabase();
  if (!sb) {
    if (snapshot !== DISABLED) {
      snapshot = DISABLED;
      onChange();
    }
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    const next: AuthState = session?.user ? { status: "signed-in", email: session.user.email ?? "" } : SIGNED_OUT;
    const same = next.status === snapshot.status && (next.status !== "signed-in" || (snapshot.status === "signed-in" && snapshot.email === next.email));
    if (same) return;
    snapshot = next;
    onChange();
  });
  return () => data.subscription.unsubscribe();
}

/** 로그인 상태 구독. 서버 렌더/첫 렌더는 항상 loading. NEXT_PUBLIC_AUTH_MOCK≠"0"이면 체험(mock) 로그인. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => snapshot, () => LOADING);
}
