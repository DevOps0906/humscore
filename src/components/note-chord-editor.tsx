"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isValidChordSymbol } from "@/lib/music/edit";
import { transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import type { ChordEvent, NoteEvent, Score } from "@/lib/music/types";

interface NoteChordEditorProps {
  score: Score;
  selected: number | null;
  onChange: (chords: ChordEvent[]) => void;
}

const EPS = 1e-6;

function NoteChordForm({ score, note, selected, onChange }: Omit<NoteChordEditorProps, "selected"> & { note: NoteEvent; selected: number }) {
  const exact = score.chords.find((chord) => Math.abs(chord.startBeat - note.startBeat) < EPS);
  const active = score.chords
    .filter((chord) => chord.startBeat <= note.startBeat + EPS)
    .reduce<ChordEvent | undefined>((previous, chord) => !previous || chord.startBeat > previous.startBeat ? chord : previous, undefined);
  const flats = transposeKey(score.key, score.transpose).fifths < 0;
  const shown = (symbol: string) => transposeChordSymbol(symbol, score.transpose, flats);
  const [value, setValue] = useState(exact ? shown(exact.symbol) : "");
  const symbol = value.trim();
  const valid = symbol.length > 0 && symbol.length <= 16 && isValidChordSymbol(symbol);
  const measure = Math.floor(note.startBeat / score.beatsPerMeasure) + 1;
  const beat = Number((note.startBeat % score.beatsPerMeasure + 1).toFixed(2));

  function apply() {
    if (!valid) return;
    const original = transposeChordSymbol(symbol, -score.transpose, score.key.fifths < 0);
    if (!isValidChordSymbol(original)) return;
    onChange([
      ...score.chords.filter((chord) => Math.abs(chord.startBeat - note.startBeat) >= EPS),
      { startBeat: note.startBeat, symbol: original },
    ].sort((left, right) => left.startBeat - right.startBeat));
    toast.success("선택한 음표 위에 코드를 붙였어요");
  }

  function remove() {
    onChange(score.chords.filter((chord) => Math.abs(chord.startBeat - note.startBeat) >= EPS));
    toast.success("선택한 음표의 코드를 지웠어요");
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-soft">{selected + 1}번째 음표 · {measure}마디 {beat}박</p>
      <label className="grid gap-1.5 text-sm">
        <span className="text-ink-soft">선택 음표 코드</span>
        <Input
          aria-label="선택 음표 코드"
          aria-invalid={Boolean(symbol) && !valid}
          aria-describedby="note-chord-help"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={16}
          placeholder="예: C, F#m7, Bb/D"
          className="h-11 w-full text-base"
        />
      </label>
      <p id="note-chord-help" className="text-xs text-ink-soft">
        {exact ? `이 음표에 붙은 코드: ${shown(exact.symbol)}` : active ? `앞에서 이어지는 코드: ${shown(active.symbol)} · 이 음표에 새 코드를 붙일 수 있어요.` : "이 음표에는 아직 코드가 없어요."}
      </p>
      {symbol && !valid && <p role="alert" className="text-sm text-tune-bad">C, F#m7, Bb/D처럼 근음과 코드 종류를 입력해 주세요. 지원 종류: 메이저·m·7·maj7·m7·dim·sus4.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={apply} disabled={!valid} className="h-11 px-4 text-sm lg:h-9">음표에 코드 적용</Button>
        <Button type="button" variant="outline" onClick={remove} disabled={!exact} className="h-11 px-4 text-sm lg:h-9">음표 코드 삭제</Button>
      </div>
    </div>
  );
}

/** 선택 음표의 시작 박에 코드를 붙인다. 화면은 전조된 코드, 저장은 원키 코드다. */
export function NoteChordEditor({ score, selected, onChange }: NoteChordEditorProps) {
  const note = selected !== null ? score.notes[selected] : undefined;
  const exact = note ? score.chords.find((chord) => Math.abs(chord.startBeat - note.startBeat) < EPS)?.symbol : undefined;
  return (
    <Card className="no-print gap-3 p-4">
      <h2 className="text-sm font-semibold">선택 음표 위 코드</h2>
      {!note || selected === null ? (
        <p className="text-sm text-ink-soft">음표 편집에서 음표를 선택하세요.</p>
      ) : note.midi === null ? (
        <p className="text-sm text-ink-soft">쉼표 대신 소리가 있는 음표를 선택해 주세요.</p>
      ) : (
        <NoteChordForm
          key={`${score.id}:${selected}:${note.startBeat}:${score.transpose}:${exact ?? ""}`}
          score={score}
          note={note}
          selected={selected}
          onChange={onChange}
        />
      )}
    </Card>
  );
}
