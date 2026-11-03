"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw } from "lucide-react";
import { AuthStatus } from "@/components/auth-status";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getDirtyCount, getSyncStatus, getUnsyncableCount, subscribeScores, subscribeSyncStatus, syncFromCloud } from "@/lib/storage/scores";
import { SettingsSection } from "./settings-section";

/** 악보 변경·동기화 상태가 바뀔 때 다시 읽는다 */
function subscribeCounts(l: () => void): () => void {
  const a = subscribeScores(l);
  const b = subscribeSyncStatus(l);
  return () => {
    a();
    b();
  };
}
const zero = () => 0;

/** 이 화면에서 마지막으로 동기화를 마친 시각 (모듈 안에만 유지, 새로고침하면 사라짐) */
let lastSyncedAt: Date | null = null;

export function AccountSection() {
  const auth = useAuth();
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
  const dirty = useSyncExternalStore(subscribeCounts, getDirtyCount, zero);
  const unsyncable = useSyncExternalStore(subscribeCounts, getUnsyncableCount, zero);
  const [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(lastSyncedAt);
  // 이전 화면 상태가 보존되므로(Next 16 Activity) 화면을 떠날 때 버튼을 되돌린다
  useEffect(() => () => setBusy(false), []);

  async function syncNow() {
    setBusy(true);
    try {
      await syncFromCloud();
      if (getSyncStatus().state !== "error") {
        lastSyncedAt = new Date();
        setSyncedAt(lastSyncedAt);
      }
    } finally {
      setBusy(false);
    }
  }

  const real = auth.status === "signed-in" && !auth.mock;

  return (
    <SettingsSection id="account" title="계정·동기화" description="로그인하면 악보가 클라우드에 저장돼 다른 기기에서도 열 수 있어요.">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm">
        <span className="min-w-0 text-ink-soft">
          {auth.status === "loading" && "로그인 상태 확인 중…"}
          {auth.status === "disabled" && "클라우드를 쓸 수 없는 환경이에요. 악보는 이 기기에만 저장돼요."}
          {auth.status === "signed-out" && "로그인하지 않았어요. 악보는 이 기기에만 저장돼요."}
          {auth.status === "signed-in" && auth.mock && "체험 로그인이에요. 악보는 이 기기에만 저장돼요."}
          {real && "로그인됨"}
        </span>
        <AuthStatus />
      </div>

      {real && (
        <div className="grid gap-3 rounded-xl border border-line p-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-soft">상태</dt>
            <dd aria-live="polite" className={sync.state === "error" ? "text-tune-warn" : ""}>
              {sync.state === "syncing" ? "동기화 중…" : sync.state === "error" ? sync.message ?? "동기화 문제" : "정상"}
            </dd>
            <dt className="text-ink-soft">올릴 변경</dt>
            <dd className="tabular-nums">{dirty}개</dd>
            {unsyncable > 0 && (
              <>
                <dt className="text-ink-soft">올릴 수 없음</dt>
                <dd className="text-tune-warn">{unsyncable}개 (너무 크거나 형식이 맞지 않아요)</dd>
              </>
            )}
            {syncedAt && (
              <>
                <dt className="text-ink-soft">마지막 동기화</dt>
                <dd className="tabular-nums">{syncedAt.toLocaleString("ko-KR")}</dd>
              </>
            )}
          </dl>
          <Button type="button" variant="outline" onClick={syncNow} disabled={busy || sync.state === "syncing"} className="h-11 w-full gap-2 sm:w-auto sm:self-start lg:h-9">
            <RefreshCw aria-hidden className={busy ? "animate-spin" : ""} />
            {busy ? "동기화 중…" : "지금 동기화"}
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}
