"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ScoreHeader } from "@/components/score-header";
import { scoreTypography } from "@/lib/music/header-fonts";
import { ScoreView } from "@/components/score-view";
import { Button } from "@/components/ui/button";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import { keyName, transposeKey } from "@/lib/music/theory";
import type { Score, KeyInfo } from "@/lib/music/types";
import type { SetlistItem } from "@/lib/storage/setlist-schema";

export type SetlistDisplayScore = {
  id: string;
  title: string;
  transpose: number;
  bpm: number;
  key: KeyInfo;
  deleted: boolean;
  score?: Score;
};

function ScoreDisclosure({ score, transpose, bpm }: { score: Score; transpose: number; bpm: number }) {
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => ({ ...score, transpose, bpm }), [score, transpose, bpm]);
  const xml = useMemo(() => scoreToMusicXML(shown, "lead", { externalHeader: true }), [shown]);

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="outline"
        className="no-print h-11 px-3 lg:h-9"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        {open ? "악보 접기" : "악보 보기"}
      </Button>
      {open && (
        <div className="mt-3 rounded-xl bg-white p-3 text-black ring-1 ring-line print:break-inside-avoid">
          <ScoreView typography={scoreTypography(shown)} xml={xml} header={<ScoreHeader score={shown} />} />
        </div>
      )}
    </div>
  );
}

export function SetlistTable({
  items,
  scores,
  emptyMessage = "아직 곡이 없어요.",
}: {
  items: SetlistItem[];
  scores: Map<string, SetlistDisplayScore>;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-soft">{emptyMessage}</p>;
  }

  return (
    <ol className="grid gap-3">
      {items.map((item, index) => {
        const score = scores.get(item.scoreId);
        const unavailable = !score || score.deleted;
        const shownKey = score ? keyName(transposeKey(score.key, item.transpose)) : null;
        const shownBpm = score ? item.bpm ?? score.bpm : item.bpm;
        return (
          <li key={`${item.scoreId}-${index}`} className="break-inside-avoid rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-section text-sm font-semibold tabular-nums" aria-label={`${index + 1}번째 곡`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`font-semibold ${unavailable ? "text-ink-soft" : ""}`}>
                  {unavailable ? "볼 수 없는 곡" : score.title}
                  {score?.deleted && <span className="ml-2 text-xs font-normal text-destructive">삭제된 악보</span>}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {shownKey ? `키 ${shownKey}` : "키 정보 없음"}
                  {shownBpm !== null && ` · ${shownBpm} BPM`}
                  {item.form && ` · ${item.form}`}
                </p>
                {item.note && <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p>}
                {item.transition && <p className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-soft">전환 · {item.transition}</p>}
                {score?.score && !score.deleted && (
                  <ScoreDisclosure score={score.score} transpose={item.transpose} bpm={item.bpm ?? score.bpm} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
