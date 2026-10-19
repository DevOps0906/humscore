"use client";
import { Suspense } from "react";

import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { AuthStatus } from "@/components/auth-status";
import { StartCard } from "@/components/start-card";
import { Card } from "@/components/ui/card";
import { keyName, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import { measureCount } from "@/lib/music/quantize";
import { sortByRecent } from "@/lib/storage/scores";
import { useScores } from "@/hooks/use-score-param";

function LibraryPageInner() {
  const stored = useScores();
  const scores = stored && sortByRecent(stored);

  return (
    <div className="flex flex-col gap-5">
      <AppLogo className="self-start" />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">내 악보</h1>
          <p className="text-sm text-ink-soft">허밍 → 악보 → 전조 → 내보내기</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AuthStatus />
          <Link href="/welcome" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-xs text-ink-soft underline underline-offset-4 outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/60">
            앱 소개
          </Link>
        </div>
      </header>

      <StartCard />

      {scores === null ? null : scores.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-soft">아직 악보가 없어요</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scores.map((s) => (
            <li key={s.id}>
              <Link href={`/scores/${s.id}`} className="group block rounded-2xl outline-none transition active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring/60">
                <Card className="gap-0 p-4 transition-colors group-hover:border-section-ghost group-hover:bg-section/40">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {keyName(transposeKey(s.key, s.transpose))}키 · {s.bpm} BPM · {measureCount(s.notes, s.beatsPerMeasure)}마디
                </p>
                <p className="mt-2 truncate text-xs text-ink-soft">{s.chords.map((c) => transposeChordSymbol(c.symbol, s.transpose, transposeKey(s.key, s.transpose).fifths < 0)).join(" · ")}</p>
                </Card>
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
    <Suspense fallback={null}>
      <LibraryPageInner />
    </Suspense>
  );
}
