"use client";

import { useEffect, useRef } from "react";
import { syncFromCloud } from "@/lib/storage/scores";
import { getSupabase } from "@/lib/storage/supabase/client";

/** 앱 시작·로그인(사용자 변경) 시 클라우드 악보를 가져와 로컬과 병합합니다. 화면은 그리지 않습니다. */
export function CloudSync() {
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        lastUser.current = null;
        return;
      }
      // 사용자가 바뀌었을 때(또는 첫 세션)만 동기화 — 같은 사용자의 중복 SIGNED_IN 은 무시
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && lastUser.current !== session.user.id) {
        lastUser.current = session.user.id;
        void syncFromCloud();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
