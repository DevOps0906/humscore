import { octaveOf, pitchClass } from "./frequency";
import { scoreMeasureCount } from "./edit";
import { chordToMidi, transposeChordSymbol, transposeKey } from "./theory";
import type { NoteEvent, Score } from "./types";

/**
 * Score → MusicXML 4.0
 * MusicXML은 악보 업계 표준 교환 형식이라 MuseScore·Finale·Sibelius·Dorico에서 그대로 열립니다.
 * 화면 렌더링(OSMD)과 파일 내보내기가 모두 이 결과물을 사용합니다.
 */

export type ScoreLayout = "lead" | "piano";

const DIVISIONS = 4; // 4분음표 = 4 → 16분음표 해상도

const DURATION_TYPES: [number, string, boolean][] = [
  [16, "whole", false],
  [12, "half", true],
  [8, "half", false],
  [6, "quarter", true],
  [4, "quarter", false],
  [3, "eighth", true],
  [2, "eighth", false],
  [1, "16th", false],
];

/** 임의 길이를 표기 가능한 음가들로 분해 (예: 5 → 4 + 1) */
function decompose(divs: number): [number, string, boolean][] {
  const parts: [number, string, boolean][] = [];
  let left = Math.round(divs);
  while (left > 0) {
    const t = DURATION_TYPES.find(([d]) => d <= left)!;
    parts.push(t);
    left -= t[0];
  }
  return parts;
}

const SHARP_SPELL: [string, number][] = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]];
const FLAT_SPELL: [string, number][] = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]];

function pitchXml(midi: number, preferFlats: boolean): string {
  const [step, alter] = (preferFlats ? FLAT_SPELL : SHARP_SPELL)[pitchClass(midi)];
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octaveOf(midi)}</octave></pitch>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KIND_MAP: [RegExp, string, string][] = [
  [/^maj7/, "major-seventh", "maj7"],
  [/^m7/, "minor-seventh", "m7"],
  [/^m/, "minor", "m"],
  [/^dim/, "diminished", "dim"],
  [/^7/, "dominant", "7"],
  [/^sus4/, "suspended-fourth", "sus4"],
  [/^$/, "major", ""],
];

function harmonyXml(symbol: string): string {
  const [main] = symbol.split("/");
  const m = /^([A-G])([#b]?)(.*)$/.exec(main);
  if (!m) return "";
  const alter = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const kind = KIND_MAP.find(([re]) => re.test(m[3])) ?? [/./, "major", m[3]];
  return `<harmony placement="above"><root><root-step>${m[1]}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ""}</root><kind text="${esc(kind[2])}">${kind[1]}</kind></harmony>`;
}

interface Piece {
  midi: number | null;
  divs: number;
  tieStart: boolean;
  tieStop: boolean;
}

/** 음표를 마디 단위로 자르고, 마디를 넘는 음은 붙임줄로 연결 */
function measurePieces(notes: NoteEvent[], m: number, beatsPerMeasure: number): Piece[] {
  const start = m * beatsPerMeasure;
  const end = start + beatsPerMeasure;
  const pieces: Piece[] = [];
  for (const n of notes) {
    const nEnd = n.startBeat + n.durationBeats;
    if (nEnd <= start + 1e-6 || n.startBeat >= end - 1e-6) continue;
    const s = Math.max(start, n.startBeat);
    const e = Math.min(end, nEnd);
    const parts = decompose((e - s) * DIVISIONS);
    parts.forEach(([d], i) => {
      const isNote = n.midi !== null;
      pieces.push({
        midi: n.midi,
        divs: d,
        tieStop: isNote && (i > 0 || n.startBeat < start - 1e-6),
        tieStart: isNote && (i < parts.length - 1 || nEnd > end + 1e-6),
      });
    });
  }
  return pieces;
}

function noteXml(p: Piece, preferFlats: boolean, staff: number, voice: number): string {
  const t = DURATION_TYPES.find(([d]) => d === p.divs)!;
  const ties = (p.tieStop ? `<tie type="stop"/>` : "") + (p.tieStart ? `<tie type="start"/>` : "");
  const tied = (p.tieStop ? `<tied type="stop"/>` : "") + (p.tieStart ? `<tied type="start"/>` : "");
  const head = p.midi === null ? "<rest/>" : pitchXml(p.midi, preferFlats);
  return `<note>${head}<duration>${p.divs}</duration>${ties}<voice>${voice}</voice><type>${t[1]}</type>${t[2] ? "<dot/>" : ""}<staff>${staff}</staff>${tied ? `<notations>${tied}</notations>` : ""}</note>`;
}

export function scoreToMusicXML(score: Score, layout: ScoreLayout = "lead"): string {
  const tp = score.transpose;
  const key = transposeKey(score.key, tp);
  const preferFlats = key.fifths < 0;
  const notes = score.notes.map((n) => ({ ...n, midi: n.midi === null ? null : n.midi + tp }));
  const chords = score.chords.map((c) => ({ ...c, symbol: transposeChordSymbol(c.symbol, tp, preferFlats) }));
  const bpm = score.beatsPerMeasure;
  const measures = scoreMeasureCount(score);
  const measureDivs = bpm * DIVISIONS;

  // 남성 음역(가온 도 아래 중심)이면 옥타브 낮춘 높은음자리표(테너 표기)
  const sung = notes.filter((n) => n.midi !== null).map((n) => n.midi!).sort((a, b) => a - b);
  const medianMidi = sung.length ? sung[sung.length >> 1] : 67;
  const trebleClef = medianMidi < 57
    ? `<clef number="1"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>`
    : `<clef number="1"><sign>G</sign><line>2</line></clef>`;

  const piano = layout === "piano";
  const body: string[] = [];
  for (let m = 0; m < measures; m++) {
    const parts: string[] = [];
    if (m === 0) {
      parts.push(
        `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` +
          `<time><beats>${bpm}</beats><beat-type>4</beat-type></time>` +
          (piano ? `<staves>2</staves>${trebleClef}<clef number="2"><sign>F</sign><line>4</line></clef>` : trebleClef) +
          `</attributes>`,
        `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.bpm}</per-minute></metronome></direction-type><sound tempo="${score.bpm}"/></direction>`,
      );
    }
    const chord = chords.find((c) => Math.abs(c.startBeat - m * bpm) < 1e-6);
    if (chord) parts.push(harmonyXml(chord.symbol));
    const pieces = measurePieces(notes, m, bpm);
    const filled = pieces.reduce((s, p) => s + p.divs, 0);
    if (pieces.length === 0) {
      parts.push(`<note><rest measure="yes"/><duration>${measureDivs}</duration><voice>1</voice><staff>1</staff></note>`);
    } else {
      for (const p of pieces) parts.push(noteXml(p, preferFlats, 1, 1));
      // 덜 찬 마디는 남은 길이를 쉼표로 채움
      if (filled < measureDivs) {
        for (const [d] of decompose(measureDivs - filled)) {
          parts.push(noteXml({ midi: null, divs: d, tieStart: false, tieStop: false }, preferFlats, 1, 1));
        }
      }
    }

    if (piano) {
      parts.push(`<backup><duration>${measureDivs}</duration></backup>`);
      const tones = chord ? chordToMidi(chord.symbol, 3) : [];
      const t = DURATION_TYPES.find(([d]) => d === measureDivs)!;
      if (tones.length === 0) {
        parts.push(`<note><rest measure="yes"/><duration>${measureDivs}</duration><voice>5</voice><staff>2</staff></note>`);
      } else {
        tones.forEach((midi, i) =>
          parts.push(
            `<note>${i > 0 ? "<chord/>" : ""}${pitchXml(midi, preferFlats)}<duration>${measureDivs}</duration><voice>5</voice><type>${t[1]}</type>${t[2] ? "<dot/>" : ""}<staff>2</staff></note>`,
          ),
        );
      }
    }
    body.push(`<measure number="${m + 1}">${parts.join("")}</measure>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${esc(score.title)}</work-title></work>
<identification><encoding><software>HumScore</software></encoding></identification>
<part-list><score-part id="P1"><part-name>${piano ? "Piano" : "Melody"}</part-name></score-part></part-list>
<part id="P1">${body.join("\n")}</part></score-partwise>`;
}
