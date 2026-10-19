"use client";
import { Suspense as __Suspense } from "react";

import Link from "next/link";
import { StartCard } from "@/components/start-card";
import { keyName, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import { measureCount } from "@/lib/music/quantize";
import { sortByRecent } from "@/lib/storage/scores";
import { useScores } from "@/hooks/use-score-param";

function LibraryPageInner() {
  const stored = useScores();
  const scores = stored && sortByRecent(stored);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-medium tracking-tight">내 악보</h1>
          <p className="text-sm text-ink-soft">허밍 → 악보 → 전조 → 내보내기</p>
        </div>
        <Link href="/welcome/" className="shrink-0 pb-1 text-xs text-ink-soft underline underline-offset-4">
          앱 소개
        </Link>
      </header>

      <StartCard />

      {scores === null ? null : scores.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">아직 악보가 없어요</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scores.map((s) => (
            <li key={s.id}>
              <Link href={`/score/?id=${s.id}`} className="block rounded-2xl bg-surface p-4 shadow-sm transition active:scale-[0.99]">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {keyName(transposeKey(s.key, s.transpose))}키 · {s.bpm} BPM · {measureCount(s.notes, s.beatsPerMeasure)}마디
                </p>
                <p className="mt-2 truncate text-xs text-ink-soft">{s.chords.map((c) => transposeChordSymbol(c.symbol, s.transpose, transposeKey(s.key, s.transpose).fifths < 0)).join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <__Suspense fallback={null}>
      <LibraryPageInner />
    </__Suspense>
  );
}
