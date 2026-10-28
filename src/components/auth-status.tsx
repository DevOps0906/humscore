"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { clearAccountData, flushPendingChanges, getSyncStatus, subscribeSyncStatus } from "@/lib/storage/scores";
import { isAuthMock, setMockSignedIn } from "@/lib/storage/auth-mock";
import { getSupabase } from "@/lib/storage/supabase/client";

/** 로그인/로그아웃 표시. Supabase 미설정이면 아무것도 그리지 않습니다. */
export function AuthStatus() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState({ pending: 0, unsyncable: 0 });
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);

  if (auth.status === "loading" || auth.status === "disabled") return null;

  if (auth.status === "signed-out" && isAuthMock()) {
    // 체험 로그인: 로그인 버튼이 곧바로 mock 세션을 다시 켠다 (서버 호출 없음)
    return (
      <Button type="button" variant="outline" onClick={() => setMockSignedIn(true)} className="h-11 shrink-0 px-4 text-accent lg:h-9">
        로그인
      </Button>
    );
  }

  if (auth.status === "signed-out") {
    return (
      <Button asChild variant="outline" className="h-11 shrink-0 px-4 text-accent lg:h-9">
        <Link href="/login">로그인</Link>
      </Button>
    );
  }

  if (auth.mock) {
    // 체험 로그인: mock 세션만 끈다 — 로컬 악보는 그대로, 서버 호출 없음
    return (
      <div className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
        <Badge variant="secondary" title="실제 계정이 아닌 체험 로그인이에요. 악보는 이 기기에만 저장돼요.">체험 로그인</Badge>
        <span className="max-w-28 truncate">{auth.mock.name}</span>
        <Button type="button" variant="outline" onClick={() => setMockSignedIn(false)} aria-label="로그아웃" className="size-11 sm:size-9">
          <LogOut aria-hidden />
        </Button>
      </div>
    );
  }

  const finishSignOut = async () => {
    setBusy(true);
    clearAccountData(); // 이 기기의 계정 데이터를 비움 (밀린 변경은 이미 올려 봤음)
    await signOut(); // 서버 쿠키 제거
    await getSupabase()?.auth.signOut({ scope: "local" }); // 브라우저 상태 갱신
    setBusy(false);
  };

  const onSignOut = async () => {
    setBusy(true);
    const rest = await flushPendingChanges(); // 세션이 살아있을 때 먼저 올려 본다
    if (rest.pending + rest.unsyncable > 0) {
      setLeft(rest);
      setBusy(false);
      return;
    }
    await finishSignOut();
  };

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-ink-soft">
      <span className="max-w-28 truncate" title={auth.email}>{auth.email || "로그인됨"}</span>
      {sync.state === "syncing" && <span aria-live="polite">동기화 중…</span>}
      {sync.state === "error" && <span role="status" className="text-tune-warn" title={sync.message}>동기화 문제</span>}
      <Button type="button" variant="outline" onClick={onSignOut} disabled={busy} aria-label="로그아웃" className="size-11 sm:size-9">
        <LogOut aria-hidden />
      </Button>
      <ConfirmDialog
        open={left.pending + left.unsyncable > 0}
        onOpenChange={(o) => !o && setLeft({ pending: 0, unsyncable: 0 })}
        title="로그아웃할까요?"
        description={[
          left.pending > 0 && `아직 올리지 못한 악보 ${left.pending}개가 있어요.`,
          left.unsyncable > 0 && `너무 크거나 형식이 맞지 않아 올릴 수 없는 악보 ${left.unsyncable}개가 있어요.`,
          "로그아웃하면 이 기기에서 지워집니다.",
        ].filter(Boolean).join(" ")}
        confirmLabel="지우고 로그아웃"
        onConfirm={() => {
          setLeft({ pending: 0, unsyncable: 0 });
          void finishSignOut();
        }}
      />
    </div>
  );
}
