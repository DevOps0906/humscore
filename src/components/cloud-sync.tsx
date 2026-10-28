"use client";

import { useEffect, useRef } from "react";
import { getDirtyCount, getSyncStatus, setSessionUserId, syncFromCloud, syncIfStale } from "@/lib/storage/scores";
import { getSupabase } from "@/lib/storage/supabase/client";

/** 앱 시작·로그인(사용자 변경) 시 클라우드 악보를 가져와 로컬과 병합합니다. 화면은 그리지 않습니다. */
export function CloudSync() {
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setSessionUserId(session?.user.id ?? null);
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
    // 실패 문구("나중에 자동으로 다시 시도")를 지키는 자동 재시도 — 화면 복귀의 최소 간격은 syncIfStale 이 보장
    const onOnline = () => void syncFromCloud(); // 네트워크 복구는 간격 제한 없이
    const onVisible = () => {
      // 화면 복귀는 실패했거나 못 올린 변경이 있을 때만 (간격 제한 유지)
      if (document.visibilityState === "visible" && (getSyncStatus().state === "error" || getDirtyCount() > 0)) void syncIfStale();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
