"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreationInstrumentSelector } from "./creation-instrument-selector";
import { getScoreParts } from "@/lib/music/parts";
import { INSTRUMENT_LABELS, ORCHESTRA_GROUPS, type CreationMode, type InstrumentId } from "@/lib/music/instrument-catalog";
import type { Score } from "@/lib/music/types";

export function ScorePartsPanel({ score, activePartId, onSelect, onAdd }: {
  score: Score;
  activePartId: string;
  onSelect: (id: string) => void;
  onAdd: (mode: CreationMode, instrument: InstrumentId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreationMode>("piano");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  return <section aria-label="악기별 악보" className="no-print grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">악기별 악보</h2>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-11 px-4 text-sm">악기 추가하기</Button>
    </div>
    <div role="group" aria-label="편집할 악기 파트" className="flex min-w-0 flex-wrap gap-2">
      {getScoreParts(score).map((part) => <Button key={part.id} type="button" variant={activePartId === part.id ? "default" : "outline"} aria-pressed={activePartId === part.id} onClick={() => onSelect(part.id)} className="h-auto min-h-11 max-w-full whitespace-normal px-3 py-2 text-sm">
        {part.partName ?? INSTRUMENT_LABELS[part.instrument]} · {part.notes.length}음
      </Button>)}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>기존 악보에 악기 추가하기</DialogTitle><DialogDescription>새 악기는 빈 악보로 추가돼요. 기존 악기의 음표와 코드는 그대로 유지합니다.</DialogDescription></DialogHeader>
        <CreationInstrumentSelector mode={mode} instrument={instrument} onModeChange={(next) => {
          setMode(next); setInstrument(next === "drums" ? "drumKit" : next === "guitarTab" ? "acousticGuitar" : next === "orchestra" ? ORCHESTRA_GROUPS[0].instruments[0] : "piano");
        }} onInstrumentChange={setInstrument} />
        <Button type="button" disabled={(score.parts?.length ?? 0) >= 32} onClick={() => { onAdd(mode, instrument); setOpen(false); }} className="h-11">악보 추가</Button>
      </DialogContent>
    </Dialog>
  </section>;
}
