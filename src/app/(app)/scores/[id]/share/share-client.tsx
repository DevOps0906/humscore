"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { createShareLink, getShareStatus, reissueShareLink, revokeShareLink, type ShareError } from "@/app/actions/share";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useScore } from "@/hooks/use-score-param";
import { flushPendingChanges, getScoresSnapshot } from "@/lib/storage/scores";
import { SHARE_ERROR_TEXT, expiryIsoFromDate, shareBlockReason } from "./share-logic";

type Status = { kind: "loading" } | { kind: "off" } | { kind: "on"; expiresAt: string | null } | { kind: "error"; error: ShareError };

function toStatus(r: Awaited<ReturnType<typeof getShareStatus>>): Status {
  if (!r.ok) return { kind: "error", error: r.error };
  return r.data.active ? { kind: "on", expiresAt: r.data.expiresAt } : { kind: "off" };
}

const DATE_INPUT =
  "h-11 w-full max-w-xs rounded-md border border-input bg-surface px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9";

/** S02 공유 설정 — 원문 링크는 발급 응답에서 1회만 보인다(재방문 시 재표시 불가). */
export function ShareClient({ id }: { id: string }) {
  const auth = useAuth();
  const { score } = useScore(id);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null); // 이번 방문에 발급된 전체 URL
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState(""); // YYYY-MM-DD, 빈 값 = 무기한
  const [confirmOff, setConfirmOff] = useState(false);
  const [unsynced, setUnsynced] = useState(false);

  const signedIn = auth.status === "signed-in" && !auth.mock;
  const refresh = useCallback(async () => {
    setStatus(toStatus(await getShareStatus(id)));
  }, [id]);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void getShareStatus(id).then((r) => {
      if (!cancelled) setStatus(toStatus(r));
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, id]);

  const blocked = shareBlockReason({
    authStatus: auth.status,
    mock: auth.status === "signed-in" && !!auth.mock,
    hasScore: score !== null && score !== undefined,
    unsynced,
  });

  /** 서버에 올리고(flush) 최신 updatedAt 을 다시 읽어 Action 에 넘긴다 */
  async function run(kind: "create" | "reissue") {
    setBusy(true);
    setCopied(false);
    try {
      const left = await flushPendingChanges();
      const current = getScoresSnapshot().find((s) => s.id === id);
      if (!current || left.pending + left.unsyncable > 0) {
        setUnsynced(true);
        return;
      }
      setUnsynced(false);
      const exp = expiryIsoFromDate(expiry);
      if (expiry && !exp) {
        toast.error(SHARE_ERROR_TEXT.invalid);
        return;
      }
      const r =
        kind === "create"
          ? await createShareLink(id, current.updatedAt, exp ?? undefined)
          : await reissueShareLink(id, current.updatedAt, exp ?? undefined);
      if (!r.ok) {
        if (r.error === "unsynced" || r.error === "stale") setUnsynced(true);
        else toast.error(SHARE_ERROR_TEXT[r.error]);
        return;
      }
      if ("path" in r.data) setLink(`${window.location.origin}${r.data.path}`);
      else toast.message("이미 공유가 켜져 있어요. 새 링크가 필요하면 '링크 새로 만들기'를 눌러 주세요.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    const r = await revokeShareLink(id);
    setBusy(false);
    if (!r.ok) {
      toast.error(SHARE_ERROR_TEXT[r.error]);
      return;
    }
    setLink(null);
    toast.success("공유를 껐어요. 기존 링크는 더 이상 열리지 않아요.");
    await refresh();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("링크를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
    }
  }

  return (
    <div className="grid gap-4">
      <Link href={`/scores/${id}`} className="inline-flex h-11 items-center gap-1 text-sm text-ink-soft hover:text-ink lg:h-9">
        <ArrowLeft className="size-4" aria-hidden /> 악보로 돌아가기
      </Link>
      <h1 className="text-xl font-semibold md:text-2xl">링크로 공유</h1>
      <Card className="gap-4 p-4 md:p-6">
        {blocked ? (
          <div className="grid gap-3" role="status">
            <p className="text-sm">{blocked.message}</p>
            {blocked.action === "login" && (
              <Link href="/welcome" className="inline-flex h-11 items-center justify-self-start rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-9">
                로그인
              </Link>
            )}
            {blocked.action === "retry" && (
              <Button type="button" variant="outline" onClick={() => setUnsynced(false)} className="h-11 justify-self-start px-4 lg:h-9">
                다시 시도
              </Button>
            )}
          </div>
        ) : status.kind === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-ink-soft" role="status" aria-busy="true">
            <LoadingSpinner size="sm" /> 공유 상태를 확인하는 중이에요
          </div>
        ) : status.kind === "error" ? (
          <div className="grid gap-3" role="alert">
            <p className="text-sm text-destructive">{SHARE_ERROR_TEXT[status.error]}</p>
            <Button type="button" variant="outline" onClick={() => void refresh()} className="h-11 justify-self-start px-4 lg:h-9">
              다시 불러오기
            </Button>
          </div>
        ) : status.kind === "off" ? (
          <div className="grid gap-3">
            <p className="text-sm text-ink-soft">링크를 만들면 로그인 없이 이 악보를 보고 재생할 수 있어요. 편집은 할 수 없어요.</p>
            <p className="text-sm text-ink-soft">수정 내용이 바로 반영됩니다.</p>
            <label className="grid gap-1 text-sm">
              만료일 (선택)
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={DATE_INPUT} />
            </label>
            <Button type="button" onClick={() => void run("create")} disabled={busy} className="h-11 justify-self-start px-4 lg:h-9">
              <Link2 aria-hidden /> {busy ? "만드는 중…" : "공유 켜기"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-tune-good">공유가 켜져 있어요</p>
            <p className="text-sm text-ink-soft">
              {status.expiresAt ? `${new Date(status.expiresAt).toLocaleDateString("ko-KR")}까지 열려요. ` : "만료일이 없어요. "}
              수정 내용이 바로 반영됩니다.
            </p>
            {link ? (
              <div className="grid gap-2">
                <p className="text-xs text-ink-soft">이 링크는 지금만 볼 수 있어요. 복사해 두세요.</p>
                <input
                  readOnly
                  value={link}
                  aria-label="공유 링크"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-11 w-full rounded-md border border-input bg-surface px-2 text-sm lg:h-9"
                />
                <Button type="button" onClick={() => void copy()} className="h-11 justify-self-start px-4 lg:h-9">
                  <Copy aria-hidden /> {copied ? "복사됨" : "링크 복사"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">보안을 위해 링크는 다시 보여 드리지 않아요. 복사하지 못했다면 새로 만들어 주세요.</p>
            )}
            <label className="grid gap-1 text-sm">
              새 링크 만료일 (선택)
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={DATE_INPUT} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void run("reissue")} disabled={busy} className="h-11 px-4 lg:h-9">
                {busy ? "만드는 중…" : "링크 새로 만들기"}
              </Button>
              <Button type="button" variant="destructive" onClick={() => setConfirmOff(true)} disabled={busy} className="h-11 px-4 lg:h-9">
                공유 끄기
              </Button>
            </div>
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="공유를 끌까요?"
        description="지금 링크로는 더 이상 악보를 볼 수 없어요."
        confirmLabel="공유 끄기"
        onConfirm={() => void turnOff()}
      />
    </div>
  );
}
