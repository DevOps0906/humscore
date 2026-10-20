import type { NoteEvent, RawNote } from "./types";

export interface QuantizeOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 격자 크기(박). 0.5 = 8분음표, 0.25 = 16분음표 */
  grid: number;
  /** 녹음 시작(0초)이 몇 박째인지. 카운트인 후 바로 녹음하면 0 */
  offsetBeats?: number;
}

/** 박(정수) 경계에서 격자 크기의 이 비율 이내면 박 위로 끌어당김 (박 쪽 편향) */
const ON_BEAT_PULL = 0.4;

/** 격자로 스냅하되, 박 경계 근처면 박에 붙임 */
export function snapBeat(beats: number, grid: number): number {
  const beat = Math.round(beats);
  if (Math.abs(beats - beat) <= grid * ON_BEAT_PULL) return beat;
  return Math.round(beats / grid) * grid;
}

const EPS = 1e-6;

/** 마이크 채보용 타이밍 보정 기본값 (초). 건반 MIDI 처럼 정확한 입력은 timing: null 로 끈다 */
export interface QuantizeTiming {
  /** 음 시작 감지 지연: 실제 시작은 감지된 시작보다 이만큼(최대) 앞에 있다고 보고 스냅 */
  onsetLeadSec: number;
  /** 성대가 먼저 멈춰 끝이 일찍 잡히는 정도: 실제 끝은 감지된 끝보다 이만큼(최대) 뒤 */
  releaseSec: number;
  /** 시작·끝 모두 이 시간(초)까지는 감지 오차(앞으로 당겨진 쪽)로 허용 */
  slackSec: number;
  /** 유성 음 사이 무성 구간이 이보다 짧으면 박 환산과 무관하게 legato */
  legatoGapSec: number;
  /** 쉼표로 인정하려면 무성 구간이 이 시간(초) 이상이고 반 박 이상이어야 함 (그 사이는 격자 반 칸 규칙) */
  restMinSec: number;
}

export const MIC_TIMING: QuantizeTiming = {
  onsetLeadSec: 0.09,
  releaseSec: 0.06,
  slackSec: 0.04,
  legatoGapSec: 0.15,
  restMinSec: 0.25,
};

export interface QuantizeOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 격자 크기(박). 0.5 = 8분음표, 0.25 = 16분음표 */
  grid: number;
  /** 녹음 시작(0초)이 몇 박째인지. 카운트인 후 바로 녹음하면 0 */
  offsetBeats?: number;
  /** 마이크 감지 지연 보정. 생략/null 이면 입력 시각을 그대로 스냅(MIDI 건반 등 정확한 입력) */
  timing?: QuantizeTiming | null;
}

/** 윈도 폭이 격자의 이 비율을 넘으면 박 > 반 박 순위 대신 rawStart 와의 거리를 우선 (0.9 격자) */
const WINDOW_RANK_MAX = 0.9;
/** 거리 우선일 때 기준점: 시작 감지는 보통 최대 지연(onsetLeadSec)의 이 비율만큼 늦다고 보고 그만큼 앞을 참조 (0.09s*2/3 = 0.06s) */
const TYPICAL_LEAD_RATIO = 2 / 3;

/**
 * [lo, hi] 구간 안의 격자점 중 하나를 고름: 박 > 반 박 > 그 밖 순으로 우선, 같으면 pref 에 가까운 쪽. 없으면 null
 */
function pickInWindow(lo: number, hi: number, g: number, pref: number, widePref: number = pref): number | null {
  // 윈도가 격자 한 칸에 가깝게 넓어지는 고템포에서는 순위보다 거리를 우선 (더 가까운 16분 위치를 박 위치가 가로채지 않게)
  const wide = hi - lo > g * WINDOW_RANK_MAX;
  let best: number | null = null;
  let bestRank = -1;
  for (let k = Math.ceil((lo - EPS) / g); k * g <= hi + EPS; k++) {
    const p = k * g;
    const rank = Math.abs(p - Math.round(p)) < EPS ? 2 : Math.abs(p * 2 - Math.round(p * 2)) < EPS ? 1 : 0;
    if (best === null) {
      best = p;
      bestRank = rank;
      continue;
    }
    const ref = wide ? widePref : pref;
    const dp = Math.abs(p - ref);
    const db = Math.abs(best - ref);
    const closer = dp < db - EPS;
    const tie = Math.abs(dp - db) <= EPS;
    const better = wide ? closer || (tie && rank > bestRank) : rank > bestRank || (rank === bestRank && closer);
    if (better) {
      best = p;
      bestRank = rank;
    }
  }
  return best;
}

const LEGATO_GRID_RATIO = 1.2;

/** 쉼표로 볼 만큼 끊겼는가 (gapSec: 실제 무성 시간, gapBeats: 박 환산) */
function isRealRest(gapSec: number, gapBeats: number, g: number, t: QuantizeTiming, spb: number): boolean {
  // 임계는 템포 비례: 격자 한 칸 시간의 1.2배를 넘지 않음 (감지 지연+성대 해제 ≈0.10s 가짜 틈은 제거, 지연 0 의 정확한 16분쉼표 gap 0.094+0.04 는 유지) (고템포의 정확한 짧은 쉼표 보존)
  if (gapSec < Math.min(t.legatoGapSec, spb * g * LEGATO_GRID_RATIO)) return false;
  if (gapSec >= t.restMinSec && gapBeats >= 0.5) return true;
  return gapBeats >= g / 2;
}

/**
 * 초 단위 음 구간 → 박자 격자에 맞춘 음표·쉼표 목록 (마디 끝까지 쉼표로 채움)
 * - 시작·끝(성대가 떨어진 지점) 모두 격자에 맞추고 길이는 최소 1격자
 * - 앞 음 끝과 다음 음 시작 사이 틈이 격자 반 칸 미만이면 붙임(legato), 1격자 이상이면 쉼표
 * - timing 이 있으면(마이크) 감지 지연만큼 앞당겨 스냅하고, 초 단위로 짧은 틈은 템포와 무관하게 legato
 */
export function quantizeNotes(raw: RawNote[], opts: QuantizeOptions): NoteEvent[] {
  const spb = 60 / opts.bpm;
  const offset = opts.offsetBeats ?? 0;
  const g = opts.grid;
  const tm = opts.timing ?? null;
  const sounded: NoteEvent[] = [];
  /** 최소 길이 보정 전 끝 위치, 원본 끝(박) */
  const meta: { natEnd: number; rawEnd: number; endSec: number }[] = [];
  const sortedRaw = [...raw].filter((n) => n.midi !== null).sort((a, b) => a.startSec - b.startSec);

  for (let idx = 0; idx < sortedRaw.length; idx++) {
    const n = sortedRaw[idx];
    const rawStart = n.startSec / spb + offset;
    const rawEnd = n.endSec / spb + offset;
    const pi = sounded.length - 1;
    const prev = sounded[pi];

    let snappedStart: number;
    let gapSec = Infinity;
    if (tm) {
      // 앞 음 끝(없으면 녹음 시작) 이전으로는 못 감
      const floorBeat = prev ? meta[pi].rawEnd : offset;
      gapSec = prev ? n.startSec - meta[pi].endSec : n.startSec;
      const lo = Math.max(floorBeat, 0, rawStart - tm.onsetLeadSec / spb);
      const hi = rawStart + tm.slackSec / spb;
      snappedStart = pickInWindow(lo, hi, g, rawStart, rawStart - (tm.onsetLeadSec * TYPICAL_LEAD_RATIO) / spb) ?? snapBeat(rawStart, g);
      // 첫 음 앞의 짧은 무성은 쉼표가 아니라 발성 지연
      if (!prev && offset === 0 && !isRealRest(gapSec, rawStart, g, tm, spb)) snappedStart = 0;
    } else {
      snappedStart = snapBeat(rawStart, g);
    }
    let start = Math.max(0, snappedStart);

    let natEnd: number;
    if (tm) {
      natEnd = pickInWindow(rawEnd - tm.slackSec / spb, rawEnd + tm.releaseSec / spb, g, rawEnd) ?? snapBeat(rawEnd, g);
    } else {
      natEnd = snapBeat(rawEnd, g);
    }
    let end = natEnd;
    if (end <= start + EPS) end = start + g;
    if (prev) {
      const prevEnd = prev.startBeat + prev.durationBeats;
      if (start < prevEnd - EPS) {
        if (start >= meta[pi].natEnd - EPS && start > prev.startBeat + EPS) {
          // 앞 음이 최소 길이 보정으로 늘어났을 뿐 -> 앞 음을 줄임
          prev.durationBeats = start - prev.startBeat;
        } else {
          start = prevEnd;
          if (end <= start + EPS) continue;
        }
      } else if (start > prevEnd + EPS) {
        const glue = tm
          ? !isRealRest(gapSec, rawStart - meta[pi].rawEnd, g, tm, spb)
          : rawStart - meta[pi].rawEnd < g / 2;
        // 사이가 짧게 붙어 있었음 -> 앞 음을 다음 음 시작까지 연장 (legato)
        if (glue) prev.durationBeats = start - prev.startBeat;
      }
    }
    sounded.push({ midi: n.midi, startBeat: start, durationBeats: end - start });
    meta.push({ natEnd, rawEnd, endSec: n.endSec });
  }

  return fillRests(sounded, opts.beatsPerMeasure);
}

/** 음표 사이 빈 곳을 쉼표로 채우고 마지막 마디를 완성 */
export function fillRests(notes: NoteEvent[], beatsPerMeasure: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  let cursor = 0;
  for (const n of notes.filter((x) => x.midi !== null).sort((a, b) => a.startBeat - b.startBeat)) {
    if (n.startBeat > cursor + 1e-6) out.push({ midi: null, startBeat: cursor, durationBeats: n.startBeat - cursor });
    out.push({ ...n });
    cursor = n.startBeat + n.durationBeats;
  }
  const total = Math.max(beatsPerMeasure, Math.ceil((cursor - 1e-6) / beatsPerMeasure) * beatsPerMeasure);
  if (total - cursor > 1e-6) out.push({ midi: null, startBeat: cursor, durationBeats: total - cursor });
  return out;
}

export function totalBeats(notes: NoteEvent[]): number {
  return notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
}

export function measureCount(notes: NoteEvent[], beatsPerMeasure: number): number {
  return Math.max(1, Math.ceil((totalBeats(notes) - 1e-6) / beatsPerMeasure));
}
