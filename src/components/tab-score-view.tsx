"use client";

import { useId, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { scoreMeasureCount } from "@/lib/music/edit";
import { midiToName } from "@/lib/music/frequency";
import { GUITAR_TUNINGS, scoreToTab, type GuitarInstrumentId } from "@/lib/music/tablature";
import { transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import type { Score } from "@/lib/music/types";

const LABELS: Record<GuitarInstrumentId, string> = {
  classicalGuitar: "클래식 기타", acousticGuitar: "통기타", electricGuitar: "일렉 기타", bassGuitar: "베이스 기타",
  bassGuitar5: "베이스기타(5현)",
};

/** 같은 Score의 실제 음높이를 기타 줄·프렛으로 표시한다. 범위 밖 음은 옥타브를 바꾸지 않는다. */
export function TabScoreView({ score, instrument, minMeasures = 1 }: { score: Score; instrument: GuitarInstrumentId; minMeasures?: number }) {
  const titleId = useId();
  const notes = useMemo(() => scoreToTab(score, instrument), [score, instrument]);
  const tuning = GUITAR_TUNINGS[instrument];
  const measures = Math.max(scoreMeasureCount(score), minMeasures);
  const systems = Math.ceil(measures / 4);
  const systemHeight = tuning.length * 24 + 72;
  const width = 1000;
  const left = 56;
  const right = 980;
  const flats = transposeKey(score.key, score.transpose).fifths < 0;
  const unavailable = notes.filter((note) => note.unplayable);
  return (
    <Card role="region" aria-label="TAB 악보" className="gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">TAB 악보 · {LABELS[instrument]}</h2>
        <p className="text-xs text-ink-soft">{tuning.length}현 표준 튜닝 · 0은 개방현 · 숫자는 프렛</p>
      </div>
      <p className="text-xs text-ink-soft">위 악보와 같은 음표·박자·전조를 사용합니다. 각 숫자 아래에는 음 길이를 박 단위로 표시합니다.</p>
      <div className="overflow-x-auto rounded-xl bg-score-paper p-2 text-[var(--shadow-ink)]">
        <svg viewBox={`0 0 ${width} ${systems * systemHeight}`} className="min-w-160 w-full" role="img" aria-labelledby={titleId}>
          <title id={titleId}>{`${score.title} · ${LABELS[instrument]} TAB 악보 · ${measures}마디`}</title>
          {Array.from({ length: systems }, (_, system) => {
            const top = system * systemHeight + 40;
            const lineMeasures = Math.min(4, measures - system * 4);
            const lineWidth = (right - left) / 4;
            const lineEnd = left + lineWidth * lineMeasures;
            return (
              <g key={system} data-testid="tab-system">
                {tuning.map((midi, string) => (
                  <g key={string}>
                    <text x={8} y={top + string * 24 + 5} fontSize={14} fill="currentColor">{midiToName(midi)}</text>
                    <line x1={left} x2={lineEnd} y1={top + string * 24} y2={top + string * 24} stroke="currentColor" />
                  </g>
                ))}
                {Array.from({ length: lineMeasures }, (_, column) => {
                  const measure = system * 4 + column;
                  const start = measure * score.beatsPerMeasure;
                  const end = start + score.beatsPerMeasure;
                  const x = left + column * lineWidth;
                  const measureNotes = notes.filter((note) => note.startBeat < end && note.startBeat + note.durationBeats > start);
                  const chords = score.chords.filter((chord) => chord.startBeat >= start && chord.startBeat < end);
                  return (
                    <g key={measure} data-testid="tab-measure" data-measure={measure + 1}>
                      <text x={x + 4} y={top - 24} fontSize={12} fill="currentColor">{measure + 1}</text>
                      <line x1={x} x2={x} y1={top} y2={top + (tuning.length - 1) * 24} stroke="currentColor" />
                      {chords.map((chord) => <text key={chord.startBeat} x={x + 16 + (chord.startBeat - start) / score.beatsPerMeasure * (lineWidth - 32)} y={top - 8} fontSize={13} fill="currentColor">{transposeChordSymbol(chord.symbol, score.transpose, flats)}</text>)}
                      {!measureNotes.length && <text x={x + lineWidth / 2} y={top + 28} fontSize={14} textAnchor="middle" fill="currentColor">쉼</text>}
                      {measureNotes.map((note) => {
                        const segmentStart = Math.max(start, note.startBeat);
                        const segmentDuration = Math.min(end, note.startBeat + note.durationBeats) - segmentStart;
                        const continued = note.startBeat < start;
                        const noteX = x + 16 + (segmentStart - start) / score.beatsPerMeasure * (lineWidth - 32);
                        const noteY = top + ((note.string ?? 1) - 1) * 24;
                        const label = note.midi === null ? "쉼" : note.unplayable ? "×" : continued ? `(${note.fret})` : String(note.fret);
                        return (
                          <g key={note.noteIndex} data-testid="tab-note" data-note-index={note.noteIndex}>
                            <title>{`${note.midi === null ? "쉼표" : note.unplayable ? `${midiToName(note.midi)} · 연주 범위 밖` : `${midiToName(note.midi)} · ${note.string}번 줄 ${note.fret}프렛`}${continued ? " · 앞 마디에서 이어짐" : ""} · ${segmentDuration}박`}</title>
                            <rect x={noteX - 15} y={noteY - 10} width={30} height={20} fill="var(--score-paper)" />
                            <text x={noteX} y={noteY + 5} textAnchor="middle" fontSize={16} fontWeight="600" fill="currentColor">{label}</text>
                            <text x={noteX} y={top + tuning.length * 24 + 6} textAnchor="middle" fontSize={11} fill="currentColor">{segmentDuration}박</text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                <line x1={lineEnd} x2={lineEnd} y1={top} y2={top + (tuning.length - 1) * 24} stroke="currentColor" strokeWidth={2} />
              </g>
            );
          })}
        </svg>
      </div>
      {unavailable.length > 0 && <p role="status" className="text-sm text-tune-warn">연주 범위 밖 음표 {unavailable.length}개는 ×로 표시했습니다. 원래 음높이는 유지하며, 전조하거나 음표를 수정하면 프렛을 다시 계산합니다.</p>}
    </Card>
  );
}
