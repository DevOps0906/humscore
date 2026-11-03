"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listShareLinks, revokeShareLink, type ShareLinkItem } from "@/app/actions/share";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SettingsSection } from "./settings-section";

type ListState = { state: "loading" } | { state: "error" } | { state: "ok"; items: ShareLinkItem[] };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

/** 로그인(실제 계정)일 때만 목록을 불러온다 */
function ShareLinkList() {
  const [list, setList] = useState<ListState>({ state: "loading" });
  const [target, setTarget] = useState<ShareLinkItem | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState(false);

  const load = useCallback((isCancelled: () => boolean = () => false) => {
    void listShareLinks()
      .catch(() => ({ ok: false as const }))
      .then((r) => {
        if (!isCancelled()) setList(r.ok ? { state: "ok", items: r.data } : { state: "error" });
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
      setRevoking(null); // 화면을 떠나면(Activity) 진행 표시를 되돌린다
    };
  }, [load]);

  async function revoke(item: ShareLinkItem) {
    setRevoking(item.id);
    setRevokeError(false);
    const r = await revokeShareLink({ kind: item.kind, id: item.id });
    setRevoking(null);
    if (!r.ok) {
      setRevokeError(true);
      return;
    }
    setList((l) => (l.state === "ok" ? { state: "ok", items: l.items.filter((x) => x.id !== item.id) } : l));
  }

  if (list.state === "loading") return <p className="text-sm text-ink-soft" aria-live="polite">불러오는 중…</p>;
  if (list.state === "error") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p role="alert" className="text-tune-bad">공유 링크를 불러오지 못했어요.</p>
        <Button type="button" variant="outline" className="h-11 lg:h-9" onClick={() => { setList({ state: "loading" }); load(); }}>
          다시 시도
        </Button>
      </div>
    );
  }
  if (list.items.length === 0) return <p className="text-sm text-ink-soft">켜 둔 공유 링크가 없어요. 악보 화면의 &lsquo;공유&rsquo;에서 만들 수 있어요.</p>;

  return (
    <>
      {revokeError && <p role="alert" className="text-sm text-tune-bad">링크를 끄지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      <ul className="grid gap-2">
        {list.items.map((item) => (
          <li key={`${item.kind}:${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
            <div className="grid min-w-0 gap-0.5">
              <Link href={item.kind === "score" ? `/scores/${item.id}` : `/setlists/${item.id}`} className="truncate font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/60">
                {item.title || "제목 없음"}
              </Link>
              <span className="text-xs text-ink-soft">
                {item.kind === "setlist" ? "콘티 · " : "악보 · "}만든 날 {fmtDate(item.createdAt)} · {item.expiresAt ? `만료 ${fmtDate(item.expiresAt)}` : "만료 없음"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={revoking === item.id}
              onClick={() => setTarget(item)}
              aria-label={`${item.title || "제목 없음"} 공유 링크 끄기`}
              className="h-11 shrink-0 text-tune-bad hover:text-tune-bad lg:h-9"
            >
              {revoking === item.id ? "끄는 중…" : "링크 끄기"}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="공유 링크를 끌까요?"
        description="이 링크로는 더 이상 악보를 볼 수 없어요. 다시 공유하려면 새 링크를 만들어야 해요."
        confirmLabel="링크 끄기"
        onConfirm={() => {
          const t = target;
          setTarget(null);
          if (t) void revoke(t);
        }}
      />
    </>
  );
}

export function ShareLinksSection() {
  const auth = useAuth();
  const real = auth.status === "signed-in" && !auth.mock;
  return (
    <SettingsSection id="share" title="공유 링크 관리" description="켜 둔 읽기 전용 공유 링크를 확인하고 끌 수 있어요.">
      {real ? (
        <ShareLinkList />
      ) : (
        <p className="text-sm text-ink-soft">
          {auth.status === "loading" && "로그인 상태 확인 중…"}
          {auth.status === "disabled" && "클라우드를 쓸 수 없는 환경이라 공유 링크를 쓸 수 없어요."}
          {auth.status === "signed-out" && "로그인하면 공유 링크를 관리할 수 있어요."}
          {auth.status === "signed-in" && auth.mock && "체험 로그인에서는 공유 링크를 쓸 수 없어요."}
        </p>
      )}
    </SettingsSection>
  );
}
