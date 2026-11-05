"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DrumKitDiagram } from "@/components/drum-kit-diagram";
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
  const [selectedMidi, setSelectedMidi] = useState(DRUM_PIECES[0].midi);
  const count = Math.max(extraMeasures, scoreMeasureCount(score));
  const current = Math.min(measure, count - 1);
  const stepDuration = 1 / resolution;
  const steps = Math.round(score.beatsPerMeasure * resolution);
  const start = current * score.beatsPerMeasure;
  const activePieces = DRUM_PIECES.filter((piece) => score.notes.some((note) => note.midi === piece.midi && note.startBeat >= start && note.startBeat < start + score.beatsPerMeasure));
  const selectedPiece = DRUM_PIECES.find((piece) => piece.midi === selectedMidi) ?? DRUM_PIECES[0];
  function selectPiece(midi: number) { setSelectedMidi(midi); onPreview(midi); }
  const isHit = (midi: number, beat: number) => score.notes.some((note) => note.midi === midi && Math.abs(note.startBeat - beat) < 1e-6);
  function toggle(midi: number, beat: number) {
    setSelectedMidi(midi);
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
      <p className="text-xs text-ink-soft">드럼 그림을 선택하면 악기 이름과 소리를 확인해요. 아래 박자 칸을 눌러 타격을 추가하고 같은 박에 여러 악기를 함께 놓을 수 있어요.</p>
      <DrumKitDiagram selectedMidi={selectedMidi} activeMidis={activePieces.map((piece) => piece.midi)} onSelect={selectPiece} />
      <div className="rounded-xl border border-line bg-paper p-3 text-sm" role="status" aria-live="polite">
        <p>선택한 드럼 구성: <strong>{selectedPiece.label}</strong> · {selectedPiece.head === "x" ? "X형 음표" : "일반 음표"}</p>
        <p className="mt-1 text-xs text-ink-soft">{current + 1}마디 구성: {activePieces.length ? activePieces.map((piece) => piece.label).join(" · ") : "아직 입력한 악기가 없어요"}</p>
      </div>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead><tr>
            <th className="bg-surface px-2 py-2 text-left font-medium">드럼 구성</th>
            {Array.from({ length: steps }, (_, step) => <th key={step} className="min-w-11 px-1 py-2 text-center text-xs font-normal text-ink-soft">{Number((step / resolution + 1).toFixed(2))}박</th>)}
          </tr></thead>
          <tbody>{DRUM_PIECES.map((piece) => <tr key={piece.id}>
            <th className={`whitespace-nowrap border-t border-line p-1 text-left ${selectedMidi === piece.midi ? "bg-accent/15 text-accent" : "bg-surface"}`}>
              <Button type="button" variant="ghost" className="h-11 justify-start px-2 text-xs" onClick={() => selectPiece(piece.midi)} aria-label={`${piece.label} 소리 듣기`}>{piece.label}</Button>
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
