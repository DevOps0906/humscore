"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { midiToName } from "@/lib/music/frequency";
import { GUITAR_TUNINGS, type GuitarInstrumentId } from "@/lib/music/tablature";

interface GuitarFretboardProps {
  instrument: GuitarInstrumentId;
  active?: number | null;
  onPress: (midi: number) => void;
}

/** 표준 조율의 줄과 프렛을 눌러 원래 음높이 그대로 연주·입력한다. */
export function GuitarFretboard({ instrument, active = null, onPress }: GuitarFretboardProps) {
  const [firstFret, setFirstFret] = useState(0);
  const tuning = GUITAR_TUNINGS[instrument];
  const frets = Array.from({ length: 7 }, (_, index) => firstFret + index);

  return (
    <section aria-label={instrument === "bassGuitar" ? "베이스 기타 지판" : "기타 지판"} className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={firstFret === 0} onClick={() => setFirstFret((fret) => Math.max(0, fret - 6))} className="h-11 rounded-full px-4 text-sm">이전 프렛</Button>
        <span className="text-sm text-ink-soft">{firstFret}~{firstFret + 6}프렛 · {tuning.length}줄</span>
        <Button type="button" variant="outline" disabled={firstFret === 18} onClick={() => setFirstFret((fret) => Math.min(18, fret + 6))} className="h-11 rounded-full px-4 text-sm">다음 프렛</Button>
      </div>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-line bg-surface p-2">
        <div className="grid min-w-max gap-1" role="group" aria-label="줄과 프렛 선택">
          <div className="grid grid-cols-8 gap-1 text-center text-xs text-ink-soft" aria-hidden>
            <span>줄</span>
            {frets.map((fret) => <span key={fret} className="py-1">{fret === 0 ? "개방현" : fret}</span>)}
          </div>
          {tuning.map((open, index) => (
            <div key={index} className="grid grid-cols-8 items-center gap-1">
              <span className="px-2 text-center text-xs text-ink-soft">{index + 1}줄 {midiToName(open)}</span>
              {frets.map((fret) => {
                const midi = open + fret;
                const selected = active === midi;
                return (
                  <Button
                    key={fret}
                    type="button"
                    variant="outline"
                    aria-label={`${index + 1}줄 ${fret}프렛 ${midiToName(midi)}`}
                    aria-pressed={selected}
                    data-string={index + 1}
                    data-fret={fret}
                    data-midi={midi}
                    onClick={() => onPress(midi)}
                    className={`h-11 min-w-11 px-2 text-xs ${selected ? "border-accent bg-accent/20 text-accent" : "bg-paper"}`}
                  >
                    {midiToName(midi)}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-soft">줄의 프렛을 클릭하거나 터치해 연주하세요. 악보생성 중에는 선택한 음이 악보에 추가돼요.</p>
    </section>
  );
}
