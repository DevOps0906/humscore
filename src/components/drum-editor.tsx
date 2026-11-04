"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DRUM_PIECES } from "@/lib/music/drums";
import { scoreMeasureCount } from "@/lib/music/edit";
import type { NoteEvent, Score } from "@/lib/music/types";

export interface DrumEditorProps {
  score: Score;
  onChange: (notes: NoteEvent[]) => void;
  onPreview: (midi: number) => void;
}

/** 같은 칸의 서로 다른 타악기는 동시에 울린다. 칸을 다시 누르면 해당 타격만 지운다. */
export function DrumEditor({ score, onChange, onPreview }: DrumEditorProps) {
  const [measure, setMeasure] = useState(0);
  const [resolution, setResolution] = useState(2);
  const [extraMeasures, setExtraMeasures] = useState(1);
  const count = Math.max(extraMeasures, scoreMeasureCount(score));
  const current = Math.min(measure, count - 1);
  const stepDuration = 1 / resolution;
  const steps = Math.round(score.beatsPerMeasure * resolution);
  const start = current * score.beatsPerMeasure;
  const isHit = (midi: number, beat: number) => score.notes.some((note) => note.midi === midi && Math.abs(note.startBeat - beat) < 1e-6);
  function toggle(midi: number, beat: number) {
    const exists = isHit(midi, beat);
    const notes = score.notes.filter((note) => !(note.midi === midi && Math.abs(note.startBeat - beat) < 1e-6));
    if (!exists) { notes.push({ midi, startBeat: beat, durationBeats: stepDuration }); onPreview(midi); }
    onChange(notes.sort((left, right) => left.startBeat - right.startBeat || (left.midi ?? 0) - (right.midi ?? 0)));
  }
  return (
    <Card className="min-w-0 gap-3 p-4" role="region" aria-label="드럼 리듬 입력">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">드럼 리듬 만들기</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 items-center gap-2 text-sm">마디
            <select aria-label="드럼 마디" value={current} onChange={(event) => setMeasure(Number(event.target.value))} className="h-11 rounded-md border border-line bg-surface px-3">
              {Array.from({ length: count }, (_, index) => <option key={index} value={index}>{index + 1}마디</option>)}
            </select>
          </label>
          <Button type="button" variant="outline" className="h-11 px-3" disabled={count >= 128} onClick={() => { setExtraMeasures(count + 1); setMeasure(count); }}>마디 추가</Button>
          <label className="flex items-center gap-2 text-sm">격자
            <select aria-label="드럼 격자" value={resolution} onChange={(event) => setResolution(Number(event.target.value))} className="h-11 rounded-md border border-line bg-surface px-3">
              <option value={2}>8분음표</option><option value={4}>16분음표</option>
            </select>
          </label>
        </div>
      </div>
      <p className="text-xs text-ink-soft">악기 이름을 누르면 소리를 듣고, 박자 칸을 누르면 타격을 추가해요. 같은 박에 킥·스네어·하이햇을 함께 놓을 수 있어요.</p>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead><tr>
            <th className="bg-surface px-2 py-2 text-left font-medium">드럼 구성</th>
            {Array.from({ length: steps }, (_, step) => <th key={step} className="min-w-11 px-1 py-2 text-center text-xs font-normal text-ink-soft">{Number((step / resolution + 1).toFixed(2))}박</th>)}
          </tr></thead>
          <tbody>{DRUM_PIECES.map((piece) => <tr key={piece.id}>
            <th className="whitespace-nowrap border-t border-line bg-surface p-1 text-left">
              <Button type="button" variant="ghost" className="h-11 justify-start px-2 text-xs" onClick={() => onPreview(piece.midi)} aria-label={`${piece.label} 소리 듣기`}>{piece.label}</Button>
            </th>
            {Array.from({ length: steps }, (_, step) => {
              const beat = start + step / resolution;
              const selected = isHit(piece.midi, beat);
              return <td key={step} className="border-t border-line p-1">
                <Button type="button" variant="outline" aria-label={`${piece.label} ${current + 1}마디 ${Number((step / resolution + 1).toFixed(2))}박`} aria-pressed={selected}
                  data-drum-midi={piece.midi} data-start-beat={beat} onClick={() => toggle(piece.midi, beat)}
                  className={`h-11 min-w-11 px-2 ${selected ? "border-accent bg-accent/20 text-accent" : "bg-paper"}`}>{selected ? "●" : "·"}</Button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">{score.notes.filter((note) => note.midi !== null).length}개 타격 · {count}마디 · 선택한 칸만 다시 누르면 삭제됩니다.</p>
    </Card>
  );
}
