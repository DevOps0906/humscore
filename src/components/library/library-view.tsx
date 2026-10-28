"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useScores } from "@/hooks/use-score-param";
import type { Score } from "@/lib/music/types";
import { sortByRecent } from "@/lib/storage/scores";
import { ScoreCardLink } from "./score-card";
import { ScoreMoreMenu } from "./score-more-menu";

type SortKey = "updated" | "title" | "created";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "최근 수정순" },
  { id: "title", label: "제목순" },
  { id: "created", label: "최근 생성순" },
];
const PAGE_SIZE = 12;

function sortScores(list: Score[], key: SortKey): Score[] {
  if (key === "updated") return sortByRecent(list);
  if (key === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title, "ko"));
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function modifiedLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return `오늘 ${hm} 수정`;
  if (diff === 1) return `어제 ${hm} 수정`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 수정`;
}

/** 비회원 배너. 로그인 상태는 기존 useAuth를 읽기만 한다(로그인/동기화 코드는 건드리지 않음). */
function GuestBanner() {
  const auth = useAuth();
  if (auth.status !== "signed-out") return null;
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-section px-4 py-3 text-sm text-lavender-100">
      <span>이 기기에 저장됨 · 로그인하면 동기화</span>
      <Link href="/login" className="inline-flex h-11 items-center font-bold text-lavender-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
        로그인
      </Link>
    </div>
  );
}

const CTRL = "h-11 w-full rounded-lg border border-input bg-surface px-3.5 text-base text-ink outline-none placeholder:text-ink-soft focus-visible:ring-3 focus-visible:ring-ring/60";

export function LibraryList() {
  const stored = useScores();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [page, setPage] = useState(1);

  const recent = useMemo(() => (stored ? sortByRecent(stored).slice(0, 3) : []), [stored]);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    if (!stored) return [];
    const found = q ? stored.filter((s) => s.title.toLowerCase().includes(q)) : stored;
    return sortScores(found, sort);
  }, [stored, q, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const sortLabel = SORTS.find((s) => s.id === sort)?.label;

  if (stored === null) {
    return (
      <section aria-label="악보 불러오는 중" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <p className="font-medium">악보 불러오는 중</p>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </section>
    );
  }

  return (
    <>
      <GuestBanner />
      {stored.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-line p-6">
          <p className="font-medium">아직 악보가 없어요</p>
          <p className="text-sm text-ink-soft">첫 멜로디를 흥얼거려 보세요. 소리는 기기 밖으로 나가지 않아요.</p>
          <Button asChild className="mt-2 h-11">
            <Link href="/record">허밍 시작</Link>
          </Button>
        </div>
      ) : (
        <>
          <section aria-labelledby="lib-recent">
            <h2 id="lib-recent" className="mb-3.5 text-xl font-medium tracking-tight">최근 수정한 악보</h2>
            <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
              {recent.map((s) => (
                <li key={s.id} className="w-4/5 flex-none snap-start md:w-auto">
                  <ScoreCardLink score={s} footer={`${modifiedLabel(s.updatedAt)} · 이어서 작업 →`} />
                </li>
              ))}
            </ul>
          </section>

          <div role="search" className="grid gap-2.5 pt-(--space-section-sm) md:grid-cols-[1fr_12.5rem] md:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="lib-q" className="text-xs text-ink-soft">제목으로 검색</label>
              <input id="lib-q" type="search" className={CTRL} placeholder="악보 제목을 입력하세요" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="lib-sort" className="text-xs text-ink-soft">정렬</label>
              <select id="lib-sort" className={CTRL} value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <section aria-labelledby="lib-all">
            <h2 id="lib-all" className="mb-3.5 text-xl font-medium tracking-tight">전체 악보</h2>
            <p className="mb-3 text-sm text-ink-soft" aria-live="polite">{list.length}개 · {sortLabel}</p>
            {list.length === 0 ? (
              <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <p className="font-medium">조건에 맞는 악보가 없어요</p>
                <p className="text-sm text-ink-soft">검색어 “{query.trim()}”로 찾은 결과가 없어요.</p>
                <Button type="button" variant="outline" className="mt-2 h-11" onClick={() => { setQuery(""); setPage(1); }}>검색 지우기</Button>
              </div>
            ) : (
              <>
                <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {shown.map((s) => (
                    <li key={s.id} className="relative">
                      <ScoreCardLink score={s} />
                      <ScoreMoreMenu score={s} />
                    </li>
                  ))}
                </ul>
                <nav aria-label="페이지 이동" className="flex items-center justify-center gap-3 pt-7 text-sm text-ink-soft">
                  <Button type="button" variant="outline" className="h-11 px-4" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>이전</Button>
                  <span>{cur} / {pages}</span>
                  <Button type="button" variant="outline" className="h-11 px-4" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>다음</Button>
                </nav>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}
