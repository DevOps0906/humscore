"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Pencil, Printer, Share2, Trash2 } from "lucide-react";
import { createShareLink, getShareStatus, revokeShareLink, type ShareError } from "@/app/actions/share";
import { deleteSetlist, type SetlistResult, type SetlistScorePreview } from "@/app/actions/setlists";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SetlistTable, type SetlistDisplayScore } from "@/components/setlists/setlist-table";
import type { Setlist } from "@/lib/storage/setlist-schema";

type Status =
  | { kind: "loading" }
  | { kind: "off" }
  | { kind: "on" }
  | { kind: "error"; error: ShareError };

function shareErrorText(error: ShareError): string {
  if (error === "unauthenticated") return "공유하려면 로그인해 주세요.";
  if (error === "unsynced" || error === "stale") return "콘티를 다시 불러온 뒤 공유해 주세요.";
  if (error === "limit") return "활성 공유 링크 한도에 도달했어요.";
  return "공유 상태를 처리하지 못했어요.";
}

export function SetlistDetail({
  setlist,
  scoreResult,
}: {
  setlist: Setlist;
  scoreResult: SetlistResult<SetlistScorePreview[]>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState("");

  const scoreMap = useMemo(() => {
    const map = new Map<string, SetlistDisplayScore>();
    if (scoreResult.ok) {
      for (const score of scoreResult.data) map.set(score.id, score);
    }
    return map;
  }, [scoreResult]);
  const refreshStatus = useCallback(async () => {
    const result = await getShareStatus({ kind: "setlist", id: setlist.id });
    setStatus(result.ok ? (result.data.active ? { kind: "on" } : { kind: "off" }) : { kind: "error", error: result.error });
  }, [setlist.id]);

  useEffect(() => {
    let active = true;
    void getShareStatus({ kind: "setlist", id: setlist.id }).then((result) => {
      if (active) setStatus(result.ok ? (result.data.active ? { kind: "on" } : { kind: "off" }) : { kind: "error", error: result.error });
    });
    return () => { active = false; };
  }, [setlist.id]);

  async function enableShare() {
    setBusy(true);
    setMessage("");
    try {
      const result = await createShareLink({ kind: "setlist", id: setlist.id }, setlist.updatedAt);
      if (!result.ok) {
        setMessage(shareErrorText(result.error));
        if (result.error === "stale" || result.error === "unsynced") router.refresh();
        return;
      }
      if (result.data.state === "created") {
        setLink(`${window.location.origin}${result.data.path}`);
        setMessage("링크를 만들었어요. 원문 링크는 이번 화면에서만 확인할 수 있으니 복사해 두세요.");
      } else {
        setMessage("이미 활성 링크가 있어요. 새 링크가 필요하면 먼저 공유를 끈 뒤 다시 만들어 주세요.");
      }
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function disableShare() {
    setBusy(true);
    setMessage("");
    try {
      const result = await revokeShareLink({ kind: "setlist", id: setlist.id });
      if (!result.ok) {
        setMessage(shareErrorText(result.error));
        return;
      }
      setLink(null);
      setMessage("공유를 껐어요. 기존 링크는 더 이상 열리지 않습니다.");
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("링크를 복사했어요.");
    } catch {
      setMessage("복사하지 못했어요. 아래 링크를 직접 선택해 복사해 주세요.");
    }
  }

  async function removeSetlist() {
    setBusy(true);
    const result = await deleteSetlist(setlist.id);
    setBusy(false);
    setDeleteOpen(false);
    if (!result.ok) {
      setMessage(result.error === "unauthenticated" ? "로그인이 만료되었어요." : "콘티를 삭제하지 못했어요.");
      return;
    }
    router.push("/setlists");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/setlists" className="inline-flex h-11 items-center gap-2 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> 콘티 목록
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 px-3"><Link href={`/setlists/${setlist.id}/edit`}><Pencil aria-hidden /> 편집</Link></Button>
          <Button type="button" variant="outline" className="h-11 px-3" onClick={() => window.print()}><Printer aria-hidden /> 인쇄</Button>
          <Button type="button" variant="destructive" className="h-11 px-3" onClick={() => setDeleteOpen(true)} disabled={busy}><Trash2 aria-hidden /> 삭제</Button>
        </div>
      </header>

      <section className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{setlist.title || "제목 없는 콘티"}</h1>
        <p className="text-sm text-ink-soft">예배일 · {setlist.serviceDate}</p>
        {setlist.memo && <p className="whitespace-pre-wrap rounded-xl bg-surface p-4">{setlist.memo}</p>}
      </section>

      <section aria-label="공유 링크" className="no-print grid gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <div className="flex items-center gap-2 font-semibold"><Share2 className="size-4" aria-hidden /> 읽기 전용 공유</div>
        <p className="text-sm text-ink-soft">
          {setlist.shareNotes ? "인도자 멘트와 곡·전환 메모가 링크 소지자에게 공개됩니다." : "인도자 멘트와 곡·전환 메모는 링크에 공개되지 않습니다."}
        </p>
        {status.kind === "loading" ? (
          <p role="status" className="text-sm text-ink-soft">공유 상태를 확인하는 중이에요.</p>
        ) : status.kind === "error" ? (
          <p role="alert" className="text-sm text-destructive">{shareErrorText(status.error)}</p>
        ) : status.kind === "off" ? (
          <Button type="button" className="h-11 justify-self-start px-4" disabled={busy} onClick={() => void enableShare()}><Share2 aria-hidden /> 공유 링크 만들기</Button>
        ) : (
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-tune-good">공유가 켜져 있어요.</p>
            {link ? (
              <>
                <input readOnly aria-label="공유 링크" value={link} onFocus={(event) => event.currentTarget.select()} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                <Button type="button" variant="outline" className="h-11 justify-self-start px-4" onClick={() => void copyLink()}><Copy aria-hidden /> 링크 복사</Button>
              </>
            ) : (
              <p className="text-sm text-ink-soft">원문 링크는 발급 시에만 표시됩니다. 다시 공유하려면 링크를 끈 뒤 새로 만들어 주세요.</p>
            )}
            <Button type="button" variant="destructive" className="h-11 justify-self-start px-4" disabled={busy} onClick={() => void disableShare()}>공유 끄기</Button>
          </div>
        )}
        {message && <p aria-live="polite" className="text-sm text-ink-soft">{message}</p>}
      </section>

      {!scoreResult.ok && <p role="alert" className="text-sm text-destructive">악보 정보를 불러오지 못했어요. 악보 제목 대신 접근할 수 없는 곡으로 표시합니다.</p>}
      <SetlistTable items={setlist.items} scores={scoreMap} />
      <footer className="text-xs text-ink-soft">악보와 가사의 공유·사용 권한 및 교회 라이선스 확인은 공유자 책임입니다.</footer>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="이 콘티를 삭제할까요?"
        description="삭제하면 기존 공유 링크도 함께 꺼집니다."
        onConfirm={() => void removeSetlist()}
      />
    </div>
  );
}
