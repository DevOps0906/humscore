"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetlistTable, type SetlistDisplayScore } from "@/components/setlists/setlist-table";
import type { SharedSetlist } from "@/lib/storage/shared-setlist";

export function SharedSetlistClient({ setlist }: { setlist: SharedSetlist }) {
  const scoreMap = useMemo(() => {
    const map = new Map<string, SetlistDisplayScore>();
    for (const score of setlist.scores) {
      map.set(score.id, {
        id: score.id,
        title: score.title,
        transpose: score.transpose,
        bpm: score.bpm,
        key: score.key,
        deleted: false,
        score,
      });
    }
    return map;
  }, [setlist.scores]);

  return (
    <main className="safe-top mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-12 pt-4 md:px-8 md:pt-6 lg:px-10 lg:pt-8 print:max-w-none print:p-0">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft">공유된 찬양 콘티</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{setlist.title || "제목 없는 콘티"}</h1>
          <p className="mt-2 text-sm text-ink-soft">예배일 · {setlist.serviceDate}</p>
        </div>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => window.print()}><Printer aria-hidden /> A4 인쇄</Button>
      </header>
      <section className="hidden print:block">
        <h1 className="text-2xl font-bold">{setlist.title || "제목 없는 콘티"}</h1>
        <p className="mt-2">예배일 · {setlist.serviceDate}</p>
      </section>
      {setlist.memo && <p className="whitespace-pre-wrap rounded-xl bg-surface p-4 print:rounded-none print:bg-white print:p-0">{setlist.memo}</p>}
      <SetlistTable items={setlist.items} scores={scoreMap} emptyMessage="이 콘티에는 아직 곡이 없어요." />
      <footer className="grid gap-2 text-xs text-ink-soft">
        <p>읽기 전용 공유입니다. 편집·삭제할 수 없습니다.</p>
        <p>악보와 가사의 공유·사용 권한 및 교회 라이선스 확인은 공유자 책임입니다.</p>
        <Link href="/" rel="noreferrer" className="no-print text-accent underline underline-offset-4">HumScore로 나만의 악보 만들기</Link>
      </footer>
    </main>
  );
}
