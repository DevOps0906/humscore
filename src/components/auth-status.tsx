"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { flushAndClearAccountData, getSyncStatus, subscribeSyncStatus } from "@/lib/storage/scores";
import { getSupabase } from "@/lib/storage/supabase/client";

/** 로그인/로그아웃 표시. Supabase 미설정이면 아무것도 그리지 않습니다. */
export function AuthStatus() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);

  if (auth.status === "loading" || auth.status === "disabled") return null;

  if (auth.status === "signed-out") {
    return (
      <Button asChild variant="outline" className="h-11 shrink-0 px-4 text-accent sm:h-9">
        <Link href="/login">로그인</Link>
      </Button>
    );
  }

  const onSignOut = async () => {
    setBusy(true);
    await flushAndClearAccountData(); // 밀린 변경을 올려 보고, 이 기기의 계정 데이터를 비움 (세션이 살아있을 때 먼저)
    await signOut(); // 서버 쿠키 제거
    await getSupabase()?.auth.signOut({ scope: "local" }); // 브라우저 상태 갱신
    setBusy(false);
  };

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
      <span className="max-w-28 truncate" title={auth.email}>{auth.email || "로그인됨"}</span>
      {sync.state === "syncing" && <span aria-live="polite">동기화 중…</span>}
      {sync.state === "error" && <span role="status" className="text-tune-warn" title={sync.message}>동기화 문제</span>}
      <Button type="button" variant="outline" onClick={onSignOut} disabled={busy} aria-label="로그아웃" className="size-11 sm:size-9">
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}
