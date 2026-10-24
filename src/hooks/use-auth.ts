"use client";

import { useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/storage/supabase/client";

export type AuthState =
  | { status: "loading" }
  | { status: "disabled" } // Supabase 환경변수 없음 → 로컬 모드
  | { status: "signed-out" }
  | { status: "signed-in"; email: string };

const LOADING: AuthState = { status: "loading" };
const DISABLED: AuthState = { status: "disabled" };
const SIGNED_OUT: AuthState = { status: "signed-out" };

let snapshot: AuthState = LOADING;

function subscribe(onChange: () => void): () => void {
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

/** 로그인 상태 구독. 서버 렌더/첫 렌더는 항상 loading. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => snapshot, () => LOADING);
}
