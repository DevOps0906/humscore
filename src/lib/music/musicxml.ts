import { scoreMeasureCount } from "./edit";
import { chordToMidi, tempoTerm, transposeChordSymbol, transposeKey } from "./theory";
import { splitForNotation, type NotationPiece } from "./notation";
import { AccidentalTracker, spellPitch, type AccidentalName, type SpelledPitch } from "./spelling";
import { timeSignatureOf } from "./meter";
import { hasUnmatchedRepeatStart } from "./form";
import type { MeasureMarkKind, Score } from "./types";

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

function pitchXml(p: SpelledPitch): string {
  return `<pitch><step>${p.step}</step>${p.alter ? `<alter>${p.alter}</alter>` : ""}<octave>${p.octave}</octave></pitch>`;
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

const MARK_WORDS: Partial<Record<MeasureMarkKind, string>> = {
  fine: "Fine",
  toCoda: "To Coda",
  dc: "D.C.",
  dcAlFine: "D.C. al Fine",
  dcAlCoda: "D.C. al Coda",
  ds: "D.S.",
  dsAlFine: "D.S. al Fine",
  dsAlCoda: "D.S. al Coda",
};

const MARK_SOUND: Partial<Record<MeasureMarkKind, string>> = {
  segno: `<sound segno="segno"/>`,
  coda: `<sound coda="coda"/>`,
  fine: `<sound fine="yes"/>`,
  toCoda: `<sound tocoda="coda"/>`,
  dc: `<sound dacapo="yes"/>`,
  dcAlFine: `<sound dacapo="yes"/>`,
  dcAlCoda: `<sound dacapo="yes"/>`,
  ds: `<sound dalsegno="segno"/>`,
  dsAlFine: `<sound dalsegno="segno"/>`,
  dsAlCoda: `<sound dalsegno="segno"/>`,
};

/** segno/coda/Fine/D.C./D.S./To Coda 방향 요소. repeatStart/repeatEnd 는 barline 이라 빈 문자열 */
function markDirectionXml(kind: MeasureMarkKind): string {
  const sound = MARK_SOUND[kind] ?? "";
  if (kind === "segno") return `<direction placement="above"><direction-type><segno/></direction-type>${sound}</direction>`;
  if (kind === "coda") return `<direction placement="above"><direction-type><coda/></direction-type>${sound}</direction>`;
  const words = MARK_WORDS[kind];
  if (!words) return "";
  return `<direction placement="above"><direction-type><words>${words}</words></direction-type>${sound}</direction>`;
}

/** offset: 현재 누적 위치 기준 상대값(divisions). 0 이면 생략 */
const dynamicDirection = (inner: string, offset = 0) =>
  `<direction placement="below"><direction-type>${inner}</direction-type>${offset ? `<offset>${offset}</offset>` : ""}<staff>1</staff></direction>`;

interface PendingDirection {
  beat: number;
  make: (offsetDivs: number) => string;
}

/** 셈여림을 마디별로: inside=마디 안 박 위치별 방향, ends=마디 끝(헤어핀 종료) 방향 */
function directionsByMeasure(score: Score, bpm: number, measures: number) {
  const inside: PendingDirection[][] = Array.from({ length: measures }, () => []);
  const ends: PendingDirection[][] = Array.from({ length: measures }, () => []);
  const eps = 1e-6;
  const clampM = (m: number) => Math.min(measures - 1, Math.max(0, m));
  const events = (score.dynamics ?? []).map((d, i) => ({ d, i })).sort((a, b) => a.d.startBeat - b.d.startBeat || a.i - b.i).map((x) => x.d);
  const open: { number: number; end: number }[] = []; // 현재 열려 있는 wedge
  for (const d of events) {
    const m = clampM(Math.floor(d.startBeat / bpm + eps));
    if (d.kind === "cresc" || d.kind === "dim") {
      const type = d.kind === "cresc" ? "crescendo" : "diminuendo";
      const end = d.startBeat + (d.durationBeats && d.durationBeats > 0 ? d.durationBeats : bpm);
      // 이미 끝난 wedge 의 번호는 재사용, 열려 있는 것과는 겹치지 않는 가장 작은 번호(1~6)
      for (let j = open.length - 1; j >= 0; j--) if (open[j].end <= d.startBeat + eps) open.splice(j, 1);
      const used = new Set(open.map((w) => w.number));
      let number = 1;
      while (used.has(number) && number < 6) number++;
      open.push({ number, end });
      inside[m].push({ beat: d.startBeat, make: (o) => dynamicDirection(`<wedge type="${type}" number="${number}"/>`, o) });
      const stop: PendingDirection = { beat: end, make: (o) => dynamicDirection(`<wedge type="stop" number="${number}"/>`, o) };
      // 끝이 마디 경계면 앞 마디 끝에, 마디 중간이면 그 박 위치에
      const em = clampM(Math.ceil(end / bpm - eps) - 1);
      if (em < m || end >= (em + 1) * bpm - eps) ends[Math.max(em, m)].push({ ...stop, beat: (Math.max(em, m) + 1) * bpm });
      else inside[em].push(stop);
    } else {
      const kind = d.kind;
      inside[m].push({ beat: d.startBeat, make: (o) => dynamicDirection(`<dynamics><${kind}/></dynamics>`, o) });
    }
  }
  return { inside, ends };
}

function noteXml(p: NotationPiece, pitch: SpelledPitch | null, accidental: AccidentalName | null, staff: number, voice: number): string {
  const ties = (p.tieStop ? `<tie type="stop"/>` : "") + (p.tieStart ? `<tie type="start"/>` : "");
  const tied = (p.tieStop ? `<tied type="stop"/>` : "") + (p.tieStart ? `<tied type="start"/>` : "");
  const head = pitch === null ? "<rest/>" : pitchXml(pitch);
  const divs = Math.round(p.durationBeats * DIVISIONS);
  return `<note>${head}<duration>${divs}</duration>${ties}<voice>${voice}</voice><type>${p.type}</type>${p.dots ? "<dot/>" : ""}${accidental ? `<accidental>${accidental}</accidental>` : ""}<staff>${staff}</staff>${tied ? `<notations>${tied}</notations>` : ""}</note>`;
}

export interface MusicXmlOptions {
  /** 최소 마디 수 — 모자라면 뒤를 온쉼표 마디로 채움(출력 전용). 기본 1 */
  minMeasures?: number;
  /** N마디마다 줄바꿈(<print new-system="yes"/>). 기본 4, 0이면 끔 */
  measuresPerSystem?: number;
  /** true 면 빠르기말·메트로놈·제목·작사/작곡/편곡자를 출력하지 않음(화면 머리글을 HTML 이 따로 그림). 기본 false */
  externalHeader?: boolean;
}

export function scoreToMusicXML(score: Score, layout: ScoreLayout = "lead", opts: MusicXmlOptions = {}): string {
  const tp = score.transpose;
  const key = transposeKey(score.key, tp);
  const preferFlats = key.fifths < 0;
  const notes = score.notes.map((n) => ({ ...n, midi: n.midi === null ? null : n.midi + tp }));
  // 음별 철자: 조의 음계음 우선, 음계 밖은 다음 음의 방향으로 결정
  const order = notes.map((n, i) => i).filter((i) => notes[i].midi !== null).sort((x, y) => notes[x].startBeat - notes[y].startBeat);
  const spelled = new Map<number, SpelledPitch>();
  order.forEach((idx, k) => {
    const nextIdx = order[k + 1];
    const prevIdx = order[k - 1];
    // 같은 음이 반복되면 앞 음의 철자를 그대로 (한 마디 안에서 C# 다음 Db 로 바뀌지 않게)
    spelled.set(
      idx,
      prevIdx !== undefined && notes[prevIdx].midi === notes[idx].midi
        ? spelled.get(prevIdx)!
        : spellPitch(notes[idx].midi!, key, { next: nextIdx === undefined ? null : notes[nextIdx].midi }),
    );
  });
  const tracker = new AccidentalTracker(key.fifths);
  const handTracker = new AccidentalTracker(key.fifths);
  const chords = score.chords.map((c) => ({ ...c, symbol: transposeChordSymbol(c.symbol, tp, preferFlats) }));
  const bpm = score.beatsPerMeasure;
  const ts = timeSignatureOf(score);
  const external = opts.externalHeader === true;
  const measures = Math.max(scoreMeasureCount(score), opts.minMeasures ?? 1);
  const perSystem = opts.measuresPerSystem ?? 4;
  const measureDivs = bpm * DIVISIONS;

  // 남성 음역(가온 도 아래 중심)이면 옥타브 낮춘 높은음자리표(테너 표기)
  const sung = notes.filter((n) => n.midi !== null).map((n) => n.midi!).sort((a, b) => a - b);
  const medianMidi = sung.length ? sung[sung.length >> 1] : 67;
  const trebleClef = medianMidi < 57
    ? `<clef number="1"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>`
    : `<clef number="1"><sign>G</sign><line>2</line></clef>`;

  const piano = layout === "piano";
  const allPieces = splitForNotation(notes, { beatsPerMeasure: bpm, measures });
  const dirs = directionsByMeasure(score, bpm, measures);
  const unmatchedStart = hasUnmatchedRepeatStart(score);
  const marksAt = (m: number) => (score.marks ?? []).filter((x) => x.measure === m).map((x) => x.kind);
  const body: string[] = [];
  const bodyLower: string[] = []; // 피아노 레이아웃의 아래 보표(반주) 파트
  const timeAttrs = `<time><beats>${ts.beats}</beats><beat-type>${ts.beatType}</beat-type></time>`;
  const keyAttrs = `<key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>`;
  for (let m = 0; m < measures; m++) {
    const kinds = marksAt(m);
    const parts: string[] = [];
    const lower: string[] = [];
    if (perSystem && perSystem > 0 && m > 0 && m % perSystem === 0) {
      parts.push(`<print new-system="yes"/>`);
      lower.push(`<print new-system="yes"/>`);
    }
    if (kinds.includes("repeatStart")) {
      const bl = `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>`;
      parts.push(bl);
      lower.push(bl);
    }
    if (m === 0) {
      parts.push(`<attributes><divisions>${DIVISIONS}</divisions>${keyAttrs}${timeAttrs}${trebleClef}</attributes>`);
      lower.push(`<attributes><divisions>${DIVISIONS}</divisions>${keyAttrs}${timeAttrs}<clef number="1"><sign>F</sign><line>4</line></clef></attributes>`);
      if (!external) {
        parts.push(
          `<direction placement="above"><direction-type><words>${tempoTerm(score.bpm)}</words></direction-type><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.bpm}</per-minute></metronome></direction-type><sound tempo="${score.bpm}"/></direction>`,
        );
      }
    }
    for (const k of kinds) if (k === "segno" || k === "coda") parts.push(markDirectionXml(k));
    const chord = chords.find((c) => Math.abs(c.startBeat - m * bpm) < 1e-6);
    if (chord) parts.push(harmonyXml(chord.symbol));
    tracker.reset();
    handTracker.reset();
    // 이 마디 안의 셈여림은 그 박을 포함하는 음표 앞에 두고, 음표 시작과 다르면 <offset> 으로 정확한 박에 놓는다
    const pending = dirs.inside[m].slice().sort((x, y) => x.beat - y.beat);
    const flush = (cursor: number, until: number) => {
      while (pending.length && pending[0].beat < until - 1e-6) {
        const d = pending.shift()!;
        parts.push(d.make(Math.round((d.beat - cursor) * DIVISIONS)));
      }
    };
    for (const p of allPieces) {
      if (p.measure !== m) continue;
      if (p.measureRest) {
        flush(m * bpm, (m + 1) * bpm);
        parts.push(`<note><rest measure="yes"/><duration>${measureDivs}</duration><voice>1</voice><staff>1</staff></note>`);
        continue;
      }
      flush(p.startBeat, p.startBeat + p.durationBeats);
      const sp = p.source !== undefined ? spelled.get(p.source) ?? null : null;
      // 붙임줄로 이어지는 뒤쪽 조각은 임시표를 반복하지 않음
      const acc = sp && !p.tieStop ? tracker.next(sp) : null;
      parts.push(noteXml(p, sp, acc, 1, 1));
    }
    flush((m + 1) * bpm, Infinity);
    // 마디 끝 위치(헤어핀 종료 등) 기호
    for (const e of dirs.ends[m]) parts.push(e.make(0));
    for (const k of kinds) if (k !== "repeatStart" && k !== "repeatEnd" && k !== "segno" && k !== "coda") parts.push(markDirectionXml(k));

    if (piano) {
      const tones = chord ? chordToMidi(chord.symbol, 3) : [];
      if (tones.length === 0) {
        lower.push(`<note><rest measure="yes"/><duration>${measureDivs}</duration><voice>1</voice><staff>1</staff></note>`);
      } else {
        // 마디 길이가 한 음가로 안 되는 박자(6/4 등)는 여러 음가로 나누고 붙임줄로 연결
        const spans = decompose(measureDivs);
        spans.forEach(([d, type, dotted], si) => {
          const tie = (si > 0 ? `<tie type="stop"/>` : "") + (si < spans.length - 1 ? `<tie type="start"/>` : "");
          const tied = (si > 0 ? `<tied type="stop"/>` : "") + (si < spans.length - 1 ? `<tied type="start"/>` : "");
          tones.forEach((midi, i) => {
            const sp = spellPitch(midi, key);
            const acc = si === 0 ? handTracker.next(sp) : null;
            lower.push(
              `<note>${i > 0 ? "<chord/>" : ""}${pitchXml(sp)}<duration>${d}</duration>${tie}<voice>1</voice><type>${type}</type>${dotted ? "<dot/>" : ""}${acc ? `<accidental>${acc}</accidental>` : ""}<staff>1</staff>${tied ? `<notations>${tied}</notations>` : ""}</note>`,
            );
          });
        });
      }
    }
    // 끝 기호 없는 ‖: 는 곡 끝까지 한 번 반복(재생과 동일하게 마지막 마디에 명시)
    const repeatEnd = kinds.includes("repeatEnd") || (m === measures - 1 && unmatchedStart);
    if (repeatEnd || m === measures - 1) {
      const bl = `<barline location="right"><bar-style>light-heavy</bar-style>${repeatEnd ? `<repeat direction="backward"/>` : ""}</barline>`;
      parts.push(bl);
      lower.push(bl);
    }
    body.push(`<measure number="${m + 1}">${parts.join("")}</measure>`);
    if (piano) bodyLower.push(`<measure number="${m + 1}">${lower.join("")}</measure>`);
  }

  const creator = (type: string, v?: string) => {
    const t = v?.trim() ?? "";
    return !external && t ? `<creator type="${type}">${esc(t)}</creator>` : "";
  };
  const creators = creator("lyricist", score.lyricist) + creator("composer", score.composer) + creator("arranger", score.arranger);
  const workTitle = external ? "" : `<work><work-title>${esc(score.title)}</work-title></work>`;
  // 멜로디 한 줄이면 라벨 숨김, 대보표면 위 보표 Melody · 아래 보표 Piano 를 각자 파트로 표기
  const scoreParts = piano
    ? `<part-group type="start" number="1"><group-symbol>brace</group-symbol><group-barline>yes</group-barline></part-group>` +
      `<score-part id="P1"><part-name>Melody</part-name><part-abbreviation>Mel.</part-abbreviation></score-part>` +
      `<score-part id="P2"><part-name>Piano</part-name><part-abbreviation>Pno.</part-abbreviation></score-part>` +
      `<part-group type="stop" number="1"/>`
    : `<score-part id="P1"><part-name print-object="no">Melody</part-name><part-abbreviation print-object="no">Mel.</part-abbreviation></score-part>`;
  const lowerPart = piano ? `\n<part id="P2">${bodyLower.join("\n")}</part>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">${workTitle}
<identification>${creators}<encoding><software>HumScore</software></encoding></identification>
<part-list>${scoreParts}</part-list>
<part id="P1">${body.join("\n")}</part>${lowerPart}</score-partwise>`;
}
