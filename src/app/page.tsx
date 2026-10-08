"use client";

import Link from "next/link";
import { keyName, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import { measureCount } from "@/lib/music/quantize";
import { sortByRecent } from "@/lib/storage/scores";
import { useScores } from "@/hooks/use-score-param";

export default function LibraryPage() {
  const stored = useScores();
  const scores = stored && sortByRecent(stored);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-medium tracking-tight">내 악보</h1>
          <p className="text-sm text-ink-soft">허밍 → 악보 → 전조 → 내보내기</p>
        </div>
        <Link href="/record/" className="rounded-lg border border-accent px-5 py-2.5 text-sm font-medium text-accent">
          새로 녹음
        </Link>
      </header>

      {scores === null ? null : scores.length === 0 ? (
        <Link href="/record/" className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-lg font-semibold">첫 멜로디를 불러 보세요</p>
          <p className="mt-1 text-sm text-ink-soft">떠오른 멜로디를 30초만 흥얼거리면 코드 악보가 만들어져요.</p>
        </Link>
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
