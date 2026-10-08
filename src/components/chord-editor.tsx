"use client";

import { useState } from "react";
import { usePianoSound } from "@/hooks/use-piano-sound";
import {
  CHORD_QUALITIES,
  chordAtMeasure,
  isValidChordSymbol,
  scoreMeasureCount,
  setChordAtMeasure,
} from "@/lib/music/edit";
import { pitchClassName } from "@/lib/music/frequency";
import { chordToMidi, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import type { ChordEvent, Score } from "@/lib/music/types";

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PARSE_RE = /^([A-G])([#b]?)(maj7|m7|m|dim|7|sus4)?(?:\/([A-G])([#b]?))?$/;

function parseSymbol(sym: string): { root: number; quality: string; bass: number | null } | null {
  const m = PARSE_RE.exec(sym);
  if (!m) return null;
  const acc = (a: string) => (a === "#" ? 1 : a === "b" ? -1 : 0);
  return {
    root: (LETTER_PC[m[1]] + acc(m[2]) + 12) % 12,
    quality: m[3] ?? "",
    bass: m[4] ? (LETTER_PC[m[4]] + acc(m[5]) + 12) % 12 : null,
  };
}

const pill = (on: boolean) =>
  `rounded-lg border px-2 py-1.5 text-sm ${on ? "border-accent bg-accent/15 text-accent" : "border-line bg-paper"}`;

/** 마디별 코드 추가·수정. 화면은 전조된 기호, 저장은 원키 기호 */
export function ChordEditor({ score, onChange }: { score: Score; onChange: (chords: ChordEvent[]) => void }) {
  const { transpose, beatsPerMeasure, chords } = score;
  const flats = transposeKey(score.key, transpose).fifths < 0;
  const { playNote } = usePianoSound();
  const [measure, setMeasure] = useState<number | null>(null);
  const [root, setRoot] = useState(0);
  const [quality, setQuality] = useState("");
  const [bass, setBass] = useState<number | null>(null);

  const count = scoreMeasureCount(score);
  const shownAt = (m: number): string | null => {
    const c = chordAtMeasure(chords, m, beatsPerMeasure);
    return c ? transposeChordSymbol(c.symbol, transpose, flats) : null;
  };

  const name = (pc: number) => pitchClassName(pc, flats);
  const symbol = `${name(root)}${quality}${bass !== null ? `/${name(bass)}` : ""}`;

  function open(m: number) {
    if (measure === m) {
      setMeasure(null);
      return;
    }
    const parsed = parseSymbol(shownAt(m) ?? "");
    setRoot(parsed?.root ?? transposeKey(score.key, transpose).tonic);
    setQuality(parsed?.quality ?? "");
    setBass(parsed?.bass ?? null);
    setMeasure(m);
  }

  function preview() {
    for (const m of chordToMidi(symbol)) playNote(m, { duration: 1.2, velocity: 0.6 });
  }

  function apply() {
    if (measure === null) return;
    preview();
    const orig = transposeChordSymbol(symbol, -transpose, score.key.fifths < 0);
    if (!isValidChordSymbol(orig)) return;
    onChange(setChordAtMeasure(chords, measure, beatsPerMeasure, orig));
    setMeasure(null);
  }

  function remove() {
    if (measure === null) return;
    onChange(setChordAtMeasure(chords, measure, beatsPerMeasure, null));
    setMeasure(null);
  }

  return (
    <section className="no-print">
      <p className="mb-2 text-xs text-ink-soft">마디를 눌러 코드 추가·수정 (마디당 1개)</p>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: count }, (_, m) => {
          const s = shownAt(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => open(m)}
              aria-pressed={measure === m}
              className={`min-w-[3.25rem] rounded-lg border px-3 py-1.5 text-sm ${
                measure === m ? "border-accent bg-accent/20" : "border-line bg-surface"
              }`}
            >
              <span className="mr-1 text-xs text-ink-soft">{m + 1}</span>
              {s ?? <span className="text-ink-soft">+</span>}
            </button>
          );
        })}
      </div>

      {measure !== null && (
        <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold">
            {measure + 1}마디 코드 · <span className="text-accent">{symbol}</span>
          </p>
          <div>
            <p className="mb-1 text-xs text-ink-soft">근음</p>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, pc) => (
                <button key={pc} type="button" onClick={() => setRoot(pc)} className={pill(root === pc)}>
                  {name(pc)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-soft">종류</p>
            <div className="flex flex-wrap gap-1.5">
              {CHORD_QUALITIES.map((q) => (
                <button key={q.suffix} type="button" onClick={() => setQuality(q.suffix)} className={pill(quality === q.suffix)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-soft">베이스음 (분수 코드, 선택)</p>
            <div className="grid grid-cols-7 gap-1.5">
              <button type="button" onClick={() => setBass(null)} className={pill(bass === null)}>
                없음
              </button>
              {Array.from({ length: 12 }, (_, pc) => (
                <button key={pc} type="button" onClick={() => setBass(pc)} className={pill(bass === pc)}>
                  {name(pc)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={apply} className="rounded-full border border-accent px-4 py-2 text-accent">
              적용
            </button>
            <button type="button" onClick={preview} className="rounded-full border border-line px-4 py-2">
              듣기
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={!chordAtMeasure(chords, measure, beatsPerMeasure)}
              className="rounded-full border border-line px-4 py-2 text-tune-bad disabled:opacity-40"
            >
              삭제
            </button>
            <button type="button" onClick={() => setMeasure(null)} className="rounded-full border border-line px-4 py-2">
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
