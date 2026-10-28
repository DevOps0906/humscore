"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { keyName, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import { measureCount } from "@/lib/music/quantize";
import type { Score } from "@/lib/music/types";

/** 악보 카드 본문(제목 · 키 · BPM · 마디 · 코드 진행). footer가 있으면 한 줄 더 그린다. */
export function ScoreCardLink({ score: s, footer }: { score: Score; footer?: string }) {
  const k = transposeKey(s.key, s.transpose);
  return (
    <Link href={`/scores/${s.id}`} className="group block h-full rounded-2xl outline-none transition active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring/60">
      <Card className="h-full gap-0 p-4 transition-colors group-hover:border-section-ghost group-hover:bg-section/40">
        <p className="truncate pr-12 font-semibold">{s.title}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {keyName(k)}키 · {s.bpm} BPM · {measureCount(s.notes, s.beatsPerMeasure)}마디
        </p>
        <p className="mt-2 truncate text-xs text-ink-soft">{s.chords.map((c) => transposeChordSymbol(c.symbol, s.transpose, k.fifths < 0)).join(" · ")}</p>
        {footer && <p className="mt-2 text-xs text-lavender-300">{footer}</p>}
      </Card>
    </Link>
  );
}
