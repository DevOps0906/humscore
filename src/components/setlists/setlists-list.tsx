"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Music2, Plus } from "lucide-react";
import { createSetlist, type SetlistResult } from "@/app/actions/setlists";
import { Button } from "@/components/ui/button";
import type { SetlistSummary } from "@/lib/storage/setlist-schema";

type ListResult = SetlistResult<SetlistSummary[]>;
const CONTROL = "h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

function message(result: ListResult): string {
  if (result.ok) return "";
  if (result.error === "unauthenticated") return "콘티를 사용하려면 로그인해 주세요.";
  if (result.error === "disabled") return "서버 저장소가 설정되지 않았어요.";
  return "콘티를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function today(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function SetlistsList({ result }: { result: ListResult }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = query.trim().toLocaleLowerCase("ko");

  const filtered = useMemo(() => {
    if (!result.ok) return [];
    return result.data.filter((setlist) =>
      (!q || setlist.title.toLocaleLowerCase("ko").includes(q)) &&
      (!from || setlist.serviceDate >= from) &&
      (!through || setlist.serviceDate <= through),
    );
  }, [result, q, from, through]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * 12, currentPage * 12);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const created = await createSetlist({
        title: "",
        serviceDate: today(),
        memo: null,
        shareNotes: true,
        items: [],
      });
      if (!created.ok) {
        setError(created.error === "unauthenticated" ? "로그인 후 콘티를 만들 수 있어요." : "콘티를 만들지 못했어요. 다시 시도해 주세요.");
        return;
      }
      router.push(`/setlists/${created.data.id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      {result.ok ? (
        <>
          <div className="grid gap-3 rounded-2xl bg-surface p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem] md:items-end">
            <label className="grid gap-1 text-xs text-ink-soft">
              예배명 검색
              <input className={CONTROL} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="예: 주일 1부" />
            </label>
            <label className="grid gap-1 text-xs text-ink-soft">
              시작일
              <input className={CONTROL} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            </label>
            <label className="grid gap-1 text-xs text-ink-soft">
              종료일
              <input className={CONTROL} type="date" value={through} onChange={(event) => { setThrough(event.target.value); setPage(1); }} />
            </label>
          </div>
          {shown.length === 0 ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-line p-6">
              <p className="font-medium">{result.data.length === 0 ? "아직 콘티가 없어요" : "조건에 맞는 콘티가 없어요"}</p>
              <p className="text-sm text-ink-soft">{result.data.length === 0 ? "새 콘티를 만들어 예배 순서를 정리해 보세요." : "검색어나 날짜 범위를 바꿔 보세요."}</p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((setlist) => (
                <li key={setlist.id}>
                  <Link href={`/setlists/${setlist.id}`} className="group flex min-h-28 flex-col justify-between rounded-2xl bg-surface p-4 ring-1 ring-line outline-none transition-colors hover:bg-section/50 focus-visible:ring-3 focus-visible:ring-ring/60">
                    <span className="font-semibold group-hover:text-accent">{setlist.title || "제목 없는 콘티"}</span>
                    <span className="mt-4 flex items-center justify-between gap-2 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" aria-hidden />{setlist.serviceDate}</span>
                      <span className="inline-flex items-center gap-1"><Music2 className="size-4" aria-hidden />{setlist.itemCount}곡</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {filtered.length > 12 && (
            <nav aria-label="콘티 페이지 이동" className="flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Button variant="outline" className="h-11 px-4" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</Button>
              <span>{currentPage} / {pages}</span>
              <Button variant="outline" className="h-11 px-4" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</Button>
            </nav>
          )}
        </>
      ) : (
        <div role="alert" className="grid gap-3 rounded-2xl bg-surface p-5">
          <p>{message(result)}</p>
          {result.error === "unauthenticated" && (
            <Button asChild className="h-11 justify-self-start px-4">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" className="h-11 justify-self-start px-4" disabled={busy || !result.ok} onClick={() => void create()}>
        <Plus aria-hidden /> {busy ? "만드는 중…" : "새 콘티"}
      </Button>
    </div>
  );
}
