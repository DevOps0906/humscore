"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/storage/supabase/client";

export type AuthState =
  | { status: "loading" }
  | { status: "disabled" } // Supabase 환경변수 없음 → 로컬 모드
  | { status: "signed-out" }
  | { status: "signed-in"; email: string };

/** 로그인 상태 구독. 서버 렌더/첫 렌더는 항상 loading. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setState({ status: "disabled" });
      return;
    }
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      setState(session?.user ? { status: "signed-in", email: session.user.email ?? "" } : { status: "signed-out" });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
