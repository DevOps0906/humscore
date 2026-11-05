"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreationInstrumentSelector } from "./creation-instrument-selector";
import { getScoreParts } from "@/lib/music/parts";
import { INSTRUMENT_LABELS, ORCHESTRA_GROUPS, type CreationMode, type InstrumentId } from "@/lib/music/instrument-catalog";
import type { Score } from "@/lib/music/types";

export function ScorePartsPanel({ score, activePartId, onSelect, onAdd, onRemove, onMerge }: {
  score: Score;
  activePartId: string;
  onSelect: (id: string) => void;
  onAdd: (mode: CreationMode, instrument: InstrumentId) => void;
  /** 선택한 악기 제거 */
  onRemove?: (partId: string) => void;
  /** from 악기의 음표를 into 악기로 합치고 from 은 제거 */
  onMerge?: (fromId: string, intoId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreationMode>("piano");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const parts = getScoreParts(score);
  const partLabel = (id: string) => { const part = parts.find((entry) => entry.id === id); return part ? (part.partName ?? INSTRUMENT_LABELS[part.instrument]) : ""; };
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeInto, setMergeInto] = useState("");
  const from = parts.some((part) => part.id === mergeFrom) ? mergeFrom : (parts[1]?.id ?? "");
  const into = parts.some((part) => part.id === mergeInto && part.id !== from) ? mergeInto : (parts.find((part) => part.id !== from)?.id ?? "");
  return <section aria-label="악기별 악보" className="no-print grid min-w-0 gap-3 rounded-xl border border-line bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">악기별 악보</h2>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-11 px-4 text-sm">악기 추가하기</Button>
      {onRemove && <Button type="button" variant="outline" disabled={parts.length <= 1} onClick={() => setRemoveOpen(true)} className="h-11 px-4 text-sm">악기 제거하기</Button>}
      {onMerge && <Button type="button" variant="outline" disabled={parts.length <= 1} onClick={() => setMergeOpen(true)} className="h-11 px-4 text-sm">악보 합치기</Button>}
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
    <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>악기 제거하기</DialogTitle><DialogDescription>선택한 「{partLabel(activePartId)}」의 음표와 코드가 삭제돼요. 다른 악기는 그대로 유지합니다.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)} className="h-11 px-5">취소</Button>
          <Button type="button" onClick={() => { onRemove?.(activePartId); setRemoveOpen(false); }} className="h-11 px-5">제거</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>악보 합치기</DialogTitle><DialogDescription>왼쪽 악기의 음표와 코드를 오른쪽 악기에 더하고, 합친 악기는 제거해요.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-sm">합칠 악기<select aria-label="합칠 악기" value={from} onChange={(event) => setMergeFrom(event.target.value)} className="h-11 rounded-md border border-line bg-surface px-2">{parts.map((part) => <option key={part.id} value={part.id}>{partLabel(part.id)}</option>)}</select></label>
          <label className="grid gap-1 text-sm">합쳐질 악기<select aria-label="합쳐질 악기" value={into} onChange={(event) => setMergeInto(event.target.value)} className="h-11 rounded-md border border-line bg-surface px-2">{parts.filter((part) => part.id !== from).map((part) => <option key={part.id} value={part.id}>{partLabel(part.id)}</option>)}</select></label>
        </div>
        <Button type="button" disabled={!from || !into || from === into} onClick={() => { onMerge?.(from, into); setMergeOpen(false); }} className="h-11">합치기</Button>
      </DialogContent>
    </Dialog>
  </section>;
}
