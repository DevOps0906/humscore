"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { appendNote, deleteNote, insertNote, measureOf, STEP_DURATIONS, updateNote } from "@/lib/music/edit";
import { midiToName, PIANO_MAX_MIDI, PIANO_MIN_MIDI } from "@/lib/music/frequency";
import { transposeKey } from "@/lib/music/theory";
import type { NoteEvent, Score } from "@/lib/music/types";

const BASE_DURS = [
  { v: 0.25, label: "16분" },
  { v: 0.5, label: "8분" },
  { v: 1, label: "4분" },
  { v: 2, label: "2분" },
  { v: 4, label: "온음표" },
];
const DOTTED = [0.75, 1.5, 3];

export const DURATION_LABELS: Record<number, string> = {
  0.25: "16분",
  0.5: "8분",
  0.75: "점8분",
  1: "4분",
  1.5: "점4분",
  2: "2분",
  3: "점2분",
  4: "온",
};

const chipBtn = (on: boolean) =>
  `h-11 rounded-full px-3.5 text-sm sm:h-9 ${on ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : "bg-surface"}`;
const actBtn = "h-11 rounded-full bg-surface px-3.5 text-sm sm:h-9";

/** 음가 선택 (16분~온음표 + 점) */
export function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const dotted = DOTTED.includes(value);
  const base = dotted ? value / 1.5 : value;
  const canDot = STEP_DURATIONS.includes(base * 1.5);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BASE_DURS.map((d) => (
        <Button
          key={d.v}
          type="button"
          variant="outline"
          onClick={() => onChange(dotted && STEP_DURATIONS.includes(d.v * 1.5) ? d.v * 1.5 : d.v)}
          className={chipBtn(base === d.v)}
          aria-pressed={base === d.v}
        >
          {d.label}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={!dotted && !canDot}
        onClick={() => onChange(dotted ? base : base * 1.5)}
        className={chipBtn(dotted)}
        aria-pressed={dotted}
      >
        점 ·
      </Button>
    </div>
  );
}

/** 악보 화면용 음표 편집기. 데이터는 원본 키, 화면(건반·음이름)은 midi + transpose */
export function NoteEditor({
  score,
  onChange,
  selected,
  onSelect,
  sound,
}: {
  score: Score;
  onChange: (notes: NoteEvent[]) => void;
  /** 선택 음 index (악보 커서와 공유) */
  selected: number | null;
  onSelect: (i: number | null) => void;
  sound: {
    playNote: (midi: number, opts?: { duration?: number; velocity?: number }) => void;
    sustain: boolean;
    setSustain: Dispatch<SetStateAction<boolean>>;
  };
}) {
  const { notes, transpose, beatsPerMeasure } = score;
  const flats = transposeKey(score.key, transpose).fifths < 0;
  const { playNote, sustain, setSustain } = sound;
  const setSelected = onSelect;
  const [addDur, setAddDur] = useState(1);

  const sel = selected !== null && selected < notes.length ? selected : null;
  const cur = sel !== null ? notes[sel] : null;
  const shownOf = (m: number | null) => (m === null ? null : m + transpose);
  const shownMidi = cur ? shownOf(cur.midi) : null;
  const dur = cur ? cur.durationBeats : addDur;
  const inRange = (shown: number) => shown >= PIANO_MIN_MIDI && shown <= PIANO_MAX_MIDI;
  const label = (n: NoteEvent) =>
    n.midi === null ? "쉼" : midiToName(n.midi + transpose, flats);

  /** 새 음을 만들 때 쓸 기본 음높이(원본 기준): 선택 음 → 가까운 음 → 가운데 도 */
  const seedMidi = (): number => {
    const from = sel ?? notes.length - 1;
    for (let i = from; i >= 0; i--) if (notes[i]?.midi != null) return notes[i].midi!;
    for (const n of notes) if (n.midi != null) return n.midi;
    return Math.min(PIANO_MAX_MIDI, Math.max(PIANO_MIN_MIDI, 60 - transpose));
  };

  function onKey(shown: number) {
    playNote(shown);
    const orig = shown - transpose;
    if (orig < PIANO_MIN_MIDI || orig > PIANO_MAX_MIDI) return;
    if (sel !== null) onChange(updateNote(notes, sel, { midi: orig }));
    else {
      onChange(appendNote(notes, orig, addDur));
      setSelected(null);
    }
  }

  function shift(delta: number) {
    if (sel === null || cur?.midi == null) return;
    const next = cur.midi + delta;
    if (next < PIANO_MIN_MIDI || next > PIANO_MAX_MIDI) return;
    playNote(next + transpose);
    onChange(updateNote(notes, sel, { midi: next }));
  }

  function setDur(v: number) {
    setAddDur(v);
    if (sel !== null) onChange(updateNote(notes, sel, { durationBeats: v }));
  }

  function remove() {
    if (sel === null) return;
    const next = deleteNote(notes, sel);
    onChange(next);
    setSelected(next.length === 0 ? null : Math.min(sel, next.length - 1));
  }

  function toggleRest() {
    if (sel === null || !cur) return;
    onChange(updateNote(notes, sel, { midi: cur.midi === null ? seedMidi() : null }));
  }

  function insertBefore() {
    if (sel === null) return;
    onChange(insertNote(notes, sel, cur?.midi ?? seedMidi(), cur?.durationBeats ?? addDur));
    // 새 음이 sel 위치에 들어가므로 선택 유지
  }

  function addAfter() {
    const at = sel === null ? notes.length : sel + 1;
    onChange(insertNote(notes, at, cur?.midi ?? seedMidi(), cur?.durationBeats ?? addDur));
    setSelected(at);
  }

  function addRest() {
    onChange(appendNote(notes, null, addDur));
    setSelected(null);
  }

  // 마디별 그룹
  const groups: { measure: number; items: { n: NoteEvent; i: number }[] }[] = [];
  notes.forEach((n, i) => {
    const m = measureOf(n.startBeat, beatsPerMeasure);
    const last = groups[groups.length - 1];
    if (last && last.measure === m) last.items.push({ n, i });
    else groups.push({ measure: m, items: [{ n, i }] });
  });

  return (
    <Card className="no-print gap-3 p-4">
      <p className="text-xs text-ink-soft" data-testid="edit-legend">
        방향키 이동 · ↑↓ 음높이 · 1–5 음표 길이 · . 점 · Enter 복제 · Delete 삭제
      </p>
      <p className="text-xs text-ink-soft">
        {sel === null
          ? "음표를 탭해 선택하거나, 아래 건반을 눌러 끝에 추가하세요."
          : "선택한 음을 편집 중 — 건반을 누르면 그 음높이로 바뀝니다."}
      </p>

      {notes.length === 0 && <p className="text-sm text-ink-soft">음표가 없어요. 건반을 눌러 추가하세요.</p>}
      <div className="grid gap-2">
        {groups.map((g) => (
          <div key={g.measure} className="flex items-start gap-2">
            <span className="mt-2 w-6 shrink-0 text-right text-xs text-ink-soft tabular-nums">{g.measure + 1}</span>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map(({ n, i }) => (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelected(i === sel ? null : i);
                    if (n.midi !== null) playNote(n.midi + transpose, { duration: 0.4 });
                  }}
                  className={`h-11 px-2.5 text-sm tabular-nums sm:h-9 ${
                    i === sel ? "border-accent bg-accent/20 font-semibold hover:bg-accent/25" : "bg-paper"
                  }`}
                  aria-pressed={i === sel}
                >
                  {label(n)}
                  <span className="ml-1 text-[11px] text-ink-soft">{DURATION_LABELS[n.durationBeats] ?? n.durationBeats}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <p className="text-xs text-ink-soft">{sel === null ? "새 음 길이" : "선택 음 길이"}</p>
        <DurationPicker value={dur} onChange={setDur} />
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null || cur?.midi == null} onClick={() => shift(1)}>
            <ArrowUp aria-hidden /> 반음
          </Button>
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null || cur?.midi == null} onClick={() => shift(-1)}>
            <ArrowDown aria-hidden /> 반음
          </Button>
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null || cur?.midi == null} onClick={() => shift(12)}>
            옥타브 +
          </Button>
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null || cur?.midi == null} onClick={() => shift(-12)}>
            옥타브 −
          </Button>
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null} onClick={toggleRest}>
            {cur?.midi === null ? "음으로" : "쉼표로"}
          </Button>
          <Button type="button" variant="outline" className={actBtn} disabled={sel === null} onClick={insertBefore}>
            앞에 삽입
          </Button>
          <Button type="button" variant="outline" className={actBtn} onClick={addAfter}>
            <Plus aria-hidden /> {sel === null ? "끝에 추가" : "뒤에 추가"}
          </Button>
          <Button type="button" variant="outline" className={actBtn} onClick={addRest}>
            쉼표 추가
          </Button>
          <Button type="button" variant="destructive" className="h-11 rounded-full px-3.5 text-sm sm:h-9" disabled={sel === null} onClick={remove}>
            <Trash2 aria-hidden /> 삭제
          </Button>
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={sustain} onChange={(e) => setSustain(e.target.checked)} className="h-5 w-5 accent-accent" />
        서스테인 페달
      </label>
      <PianoKeyboard
        onPress={onKey}
        active={shownMidi !== null && inRange(shownMidi) ? shownMidi : null}
        highlight={shownMidi !== null ? new Set([shownMidi]) : undefined}
      />
    </Card>
  );
}
