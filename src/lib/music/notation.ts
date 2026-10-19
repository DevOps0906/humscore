import type { NoteEvent } from "./types";

/**
 * 기보 법칙에 따른 표기 분할 (순수 함수).
 * 소리 길이(NoteEvent)는 그대로 두고, 악보 출력 시에만 표기 가능한 음가 조각으로 나눕니다.
 * 지원 박자: N/4 (2/4, 3/4, 4/4, 5/4, 6/4 ...). 6/8 같은 복합박자는 모델(beatUnit: 4)이 지원하지 않아 다루지 않음.
 */

export type NotationType = "16th" | "eighth" | "quarter" | "half" | "whole";

export interface NotationPiece {
  midi: number | null;
  startBeat: number;
  durationBeats: number;
  type: NotationType;
  dots: 0 | 1;
  tieStart: boolean;
  tieStop: boolean;
  /** 0 기반 마디 번호 */
  measure: number;
  /** 마디 전체 쉼표(<rest measure="yes"/>) */
  measureRest?: boolean;
  /** 입력 events 배열에서의 원본 인덱스 (쉼표 채움 조각은 없음) */
  source?: number;
}

export interface NotationOptions {
  beatsPerMeasure: number;
  beatUnit?: 4;
  /** 최소 마디 수 (모자라면 온쉼표 마디로 채움) */
  measures?: number;
}

const TPB = 4; // 1박 = 4틱(16분음표)
const VALUES: Record<number, [NotationType, 0 | 1]> = {
  1: ["16th", 0],
  2: ["eighth", 0],
  3: ["eighth", 1],
  4: ["quarter", 0],
  6: ["quarter", 1],
  8: ["half", 0],
  12: ["half", 1],
  16: ["whole", 0],
};

/** 음표 한 덩어리가 (틱 a 에서 길이 len) 표기상 허용되는가 */
function noteAllowed(a: number, len: number, M: number, pattern: boolean): boolean {
  const onBeat = a % TPB === 0;
  switch (len) {
    case 1:
      return true;
    case 2:
      return (a % TPB) + 2 <= TPB;
    case 3:
      return onBeat;
    case 4:
      return onBeat || (M === 16 && (a === 2 || a === 10)); // 8분-4분-8분 당김음
    case 6:
      return onBeat && !(M === 16 && a < 8 && a + 6 > 8);
    case 8:
      if (M === 16) return a === 0 || a === 8 || (a === 4 && pattern);
      return onBeat && (a % 8 === 0 || a + 8 === M);
    case 12:
      return M === 16 ? a === 0 : a === 0 || a + 12 === M;
    case 16:
      return M === 16 && a === 0;
    default:
      return false;
  }
}

const strongBoundary = (M: number): number | null => (M === 16 ? 8 : M === 24 ? 12 : null);

function splitNote(a: number, b: number, M: number, pattern: boolean): [number, number][] {
  const len = b - a;
  if (noteAllowed(a, len, M, pattern)) return [[a, len]];
  let s: number | null = null;
  const strong = strongBoundary(M);
  if (strong !== null && a < strong && strong < b) s = strong;
  else {
    const nb = (Math.floor(a / TPB) + 1) * TPB;
    if (nb < b) s = nb;
  }
  if (s === null) s = a + (a % 2 === 1 || len < 2 ? 1 : 2); // 한 박 안: 작은 음가부터
  return [...splitNote(a, s, M, pattern), ...splitNote(s, b, M, pattern)];
}

function splitRest(a: number, b: number, M: number): [number, number][] {
  const out: [number, number][] = [];
  let pos = a;
  while (pos < b) {
    if (pos % TPB !== 0) {
      const lim = Math.min(b, (Math.floor(pos / TPB) + 1) * TPB);
      const len = pos % 2 === 1 || lim - pos < 2 ? 1 : 2;
      out.push([pos, len]);
      pos += len;
      continue;
    }
    const beats = Math.floor((b - pos) / TPB);
    const halfOk = M === 16 ? pos === 0 || pos === 8 : pos % 8 === 0;
    if (beats >= 2 && halfOk) {
      out.push([pos, 8]);
      pos += 8;
    } else if (beats >= 1) {
      out.push([pos, 4]);
      pos += 4;
    } else {
      const r = b - pos;
      if (r === 3) out.push([pos, 2], [pos + 2, 1]);
      else out.push([pos, r]);
      pos = b;
    }
  }
  return out;
}

interface Seg {
  midi: number | null;
  s: number;
  e: number;
  source?: number;
}

export function splitForNotation(events: NoteEvent[], opts: NotationOptions): NotationPiece[] {
  const M = Math.round(opts.beatsPerMeasure * TPB);
  const sorted = events.map((ev, source) => ({ ev, source })).sort((x, y) => x.ev.startBeat - y.ev.startBeat);

  // 1) 틱 단위 정리: 겹침은 뒤 음 시작을 미룸, 빈 곳은 쉼표
  const segs: Seg[] = [];
  let cursor = 0;
  const pushRest = (s: number, e: number) => {
    if (e <= s) return;
    const last = segs[segs.length - 1];
    if (last && last.midi === null && last.e === s) last.e = e;
    else segs.push({ midi: null, s, e });
  };
  for (const { ev, source } of sorted) {
    const s = Math.max(Math.round(ev.startBeat * TPB), cursor);
    const e = Math.round((ev.startBeat + ev.durationBeats) * TPB);
    if (e <= s) continue;
    pushRest(cursor, s);
    if (ev.midi === null) pushRest(s, e);
    else segs.push({ midi: ev.midi, s, e, source });
    cursor = e;
  }
  const measures = Math.max(opts.measures ?? 1, Math.ceil(cursor / M), 1);
  pushRest(cursor, measures * M);

  // 2) 마디별 조각
  const pieces: NotationPiece[] = [];
  for (let m = 0; m < measures; m++) {
    const m0 = m * M;
    const m1 = m0 + M;
    const inM: (Seg & { tieIn: boolean; tieOut: boolean })[] = [];
    for (const sg of segs) {
      if (sg.e <= m0 || sg.s >= m1) continue;
      inM.push({ ...sg, s: Math.max(sg.s, m0), e: Math.min(sg.e, m1), tieIn: sg.s < m0, tieOut: sg.e > m1 });
    }
    const emit = (sg: Seg, a: number, len: number, tieStart: boolean, tieStop: boolean) => {
      const [type, dots] = VALUES[len];
      pieces.push({
        midi: sg.midi,
        startBeat: (m0 + a) / TPB,
        durationBeats: len / TPB,
        type,
        dots,
        tieStart,
        tieStop,
        measure: m,
        source: sg.source,
      });
    };
    if (inM.length === 1 && inM[0].midi === null) {
      pieces.push({
        midi: null,
        startBeat: m0 / TPB,
        durationBeats: M / TPB,
        type: "whole",
        dots: 0,
        tieStart: false,
        tieStop: false,
        measure: m,
        measureRest: true,
      });
      continue;
    }
    const pattern =
      M === 16 && inM.length === 3 && inM[0].e - m0 === 4 && inM[1].s - m0 === 4 && inM[1].e - m0 === 12 && inM[2].s - m0 === 12;
    for (const sg of inM) {
      const a = sg.s - m0;
      const b = sg.e - m0;
      if (sg.midi === null) {
        for (const [pa, pl] of splitRest(a, b, M)) emit(sg, pa, pl, false, false);
      } else {
        const parts = splitNote(a, b, M, pattern);
        parts.forEach(([pa, pl], i) => emit(sg, pa, pl, i < parts.length - 1 || sg.tieOut, i > 0 || sg.tieIn));
      }
    }
  }
  return pieces;
}
