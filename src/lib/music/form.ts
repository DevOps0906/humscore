import { measureOf, scoreMeasureCount } from "./edit";
import { LEVELS, nearestLevelIndex, velocityAt } from "./dynamics";
import type { DynamicEvent, MeasureMarkKind, Score } from "./types";

/**
 * 도돌이표·D.C./D.S. 해석 (순수 함수).
 * Score.marks 를 따라가며 실제로 연주되는 마디 순서를 만든다.
 */

const DC_KINDS: MeasureMarkKind[] = ["dc", "dcAlFine", "dcAlCoda"];
const DS_KINDS: MeasureMarkKind[] = ["ds", "dsAlFine", "dsAlCoda"];

/** 끝 기호(repeatEnd)가 없는 repeatStart 가 있으면 true. 곡 끝에서 한 번 반복하는 것으로 해석한다 */
export function hasUnmatchedRepeatStart(score: Score): boolean {
  const marks = score.marks ?? [];
  const ends = marks.filter((m) => m.kind === "repeatEnd").map((m) => m.measure);
  return marks.some((m) => m.kind === "repeatStart" && !ends.some((e) => e >= m.measure));
}

/** 재생 마디 순서(0부터). marks 가 없으면 [0..마지막 마디] */
export function measureOrder(score: Score): number[] {
  const total = scoreMeasureCount(score);
  const all = Array.from({ length: total }, (_, i) => i);
  const marks = (score.marks ?? []).filter((m) => Number.isInteger(m.measure) && m.measure >= 0 && m.measure < total);
  if (marks.length === 0) return all;

  const at = (measure: number, kinds: MeasureMarkKind[]) => marks.find((m) => m.measure === measure && kinds.includes(m.kind))?.kind;
  const has = (measure: number, kind: MeasureMarkKind) => marks.some((m) => m.measure === measure && m.kind === kind);
  const first = (kind: MeasureMarkKind) => {
    const found = marks.filter((m) => m.kind === kind).map((m) => m.measure);
    return found.length ? Math.min(...found) : -1;
  };
  const segno = first("segno");
  const coda = first("coda");
  const starts = marks.filter((m) => m.kind === "repeatStart").map((m) => m.measure);
  // 짝 없는 repeatStart 는 마지막 마디에 끝 기호가 있는 것으로 본다
  const implicitEnd = hasUnmatchedRepeatStart({ ...score, marks }) ? total - 1 : -1;
  const isRepeatEnd = (m: number) => has(m, "repeatEnd") || m === implicitEnd;
  let lastEnd = -1; // 직전에 처리한 도돌이 끝 마디

  const order: number[] = [];
  const repeated = new Set<number>();
  let jump: "none" | "fine" | "coda" | "plain" = "none";
  let jumped = false;
  let codaDone = false;
  let pos = 0;
  // 도돌이 끝은 마디마다 최대 한 번씩 작동(되돌아가며 최대 total 마디 재생) + D.C./D.S. 한 번 더(total*2) 이므로 이론 최대보다 넉넉한 안전 상한
  const limit = total * (total + 4) + 16;

  while (pos >= 0 && pos < total && order.length < limit) {
    order.push(pos);

    if (jumped) {
      if (jump === "fine" && has(pos, "fine")) break;
      if (jump === "coda" && !codaDone && coda >= 0 && has(pos, "toCoda")) {
        codaDone = true;
        pos = coda;
        continue;
      }
      pos++;
      continue;
    }

    if (isRepeatEnd(pos) && !repeated.has(pos)) {
      repeated.add(pos);
      // 되돌아갈 곳: 직전 ‖: 와 직전 :‖ 다음 마디 중 더 뒤쪽
      const target = starts.filter((s) => s <= pos);
      const back = Math.max(target.length ? Math.max(...target) : 0, lastEnd + 1);
      lastEnd = Math.max(lastEnd, pos);
      pos = Math.min(back, pos);
      continue;
    }
    const dc = at(pos, DC_KINDS);
    if (dc) {
      jumped = true;
      jump = dc === "dcAlFine" ? "fine" : dc === "dcAlCoda" ? "coda" : "plain";
      pos = 0;
      continue;
    }
    const ds = at(pos, DS_KINDS);
    if (ds && segno >= 0) {
      jumped = true;
      jump = ds === "dsAlFine" ? "fine" : ds === "dsAlCoda" ? "coda" : "plain";
      pos = segno;
      continue;
    }
    // segno 없는 D.S. 는 무시하고 그냥 진행
    pos++;
  }
  return order;
}

/** 반복을 모두 펼친 일렬 타임라인 Score. marks 는 비우고 원본은 건드리지 않음 */
export function unrollScore(score: Score): Score {
  const bpm = score.beatsPerMeasure;
  const total = scoreMeasureCount(score);
  const order = measureOrder(score);
  const notes: Score["notes"] = [];
  const chords: Score["chords"] = [];
  const dynamics: DynamicEvent[] = [];
  const srcDyn = score.dynamics ?? [];
  const inMeasure = (beat: number, m: number) => Math.min(total - 1, measureOf(beat, bpm)) === m;
  const chordsIn = (m: number) => score.chords.filter((c) => inMeasure(c.startBeat, m));

  const isLevelEv = (d: DynamicEvent) => d.kind !== "cresc" && d.kind !== "dim";
  // 셈여림은 "구간 단위 닫힘": 이어 연주되는 마디 묶음(구간)마다 헤어핀을 구간 끝에서 자르고, 들어갈 때·나올 때 그 자리 값을 단계 기호로 적는다.
  // (velocityAt 의 헤어핀 목표는 미래의 단계 기호를 끝없이 찾으므로, 사후 보정 대신 구간 밖을 보지 않게 닫는다)
  const lastBefore = (beat: number) => srcDyn.reduce<DynamicEvent | undefined>((p, d) => (d.startBeat < beat - 1e-6 && (!p || d.startBeat >= p.startBeat) ? d : p), undefined);
  const nearestLevel = (v: number) => LEVELS[nearestLevelIndex(v)];
  const pushDyn = (d: DynamicEvent) => {
    // 같은 박·같은 종류 단계 기호가 이미 있으면 생략(이탈 목표와 진입 기호가 같을 때)
    if (isLevelEv(d) && dynamics.some((x) => x.kind === d.kind && Math.abs(x.startBeat - d.startBeat) < 1e-6)) return;
    dynamics.push(d);
  };
  // 각 k 가 속한 구간의 원본 끝 박. 원본 마지막 마디로 끝나는 마지막 구간만 닫지 않음(Infinity) — Fine 등 중간에서 끝나면 닫는다
  const segEndOrig: number[] = new Array(order.length);
  for (let k = order.length - 1; k >= 0; k--) {
    if (k + 1 < order.length && order[k + 1] === order[k] + 1) segEndOrig[k] = segEndOrig[k + 1];
    else segEndOrig[k] = k === order.length - 1 && order[k] === total - 1 ? Infinity : (order[k] + 1) * bpm;
  }
  const clip = (d: DynamicEvent, segEnd: number): DynamicEvent =>
    isLevelEv(d) || d.durationBeats === undefined ? d : { ...d, durationBeats: Math.min(d.startBeat + d.durationBeats, segEnd) - d.startBeat };

  order.forEach((m, k) => {
    const shift = (k - m) * bpm;
    const contiguous = k + 1 < order.length && order[k + 1] === m + 1;
    const isLast = k === order.length - 1;
    for (const n of score.notes) {
      if (!inMeasure(n.startBeat, m)) continue;
      // 다음에 연주되는 마디가 이어지지 않으면 마디 끝에서 자른다(마지막 마디는 그대로 둠)
      const room = (m + 1) * bpm - n.startBeat;
      const dur = contiguous || isLast ? n.durationBeats : Math.min(n.durationBeats, room);
      notes.push({ ...n, startBeat: n.startBeat + shift, durationBeats: dur });
    }
    const jumpedIn = k > 0 && order[k - 1] !== m - 1;
    const entered = k === 0 ? m > 0 : jumpedIn;
    const chordHere = chordsIn(m);
    for (const c of chordHere) chords.push({ ...c, startBeat: c.startBeat + shift });
    if (entered && !chordHere.some((c) => Math.abs(c.startBeat - m * bpm) < 1e-6)) {
      // 건너뛰어 들어온 마디 첫 박에 코드가 없으면 원래 그 자리에 유효한 코드를 넣는다(이전 구간 코드가 이어지지 않게)
      let prev: (typeof score.chords)[number] | undefined;
      for (const c of score.chords) if (c.startBeat <= m * bpm + 1e-6 && (!prev || c.startBeat >= prev.startBeat)) prev = c;
      if (prev) chords.push({ ...prev, startBeat: m * bpm + shift });
    }
    const here = srcDyn.filter((d) => inMeasure(d.startBeat, m));
    const segEnd = segEndOrig[k];
    const start = m * bpm;
    if (srcDyn.length && entered && !here.some((d) => isLevelEv(d) && Math.abs(d.startBeat - start) < 1e-6)) {
      // 진입: 건너뛰어 들어온 마디 첫 박에 그 자리 값에 가장 가까운 단계를 적고 (첫 박에 단계 기호가 있으면 그것이 대신함),
      // 직전 헤어핀이 아직 진행 중이면 남은 길이만큼 이어 붙인다
      pushDyn({ startBeat: start + shift, kind: nearestLevel(velocityAt(srcDyn, start)) });
      const prev = lastBefore(start);
      if (prev && !isLevelEv(prev)) {
        const end = prev.startBeat + (prev.durationBeats ?? 0);
        if (end > start + 1e-6) pushDyn({ ...clip({ ...prev, startBeat: start, durationBeats: end - start }, segEnd), startBeat: start + shift });
      }
    }
    for (const d of here) pushDyn({ ...clip(d, segEnd), startBeat: d.startBeat + shift });
    if (!contiguous && Number.isFinite(segEnd) && srcDyn.length) {
      // 이탈: 구간 끝 직전 기호가 헤어핀이면 그 자리 값(왼쪽 극한)을 구간 끝 박에 단계로 적어 잘린 헤어핀의 목표로 삼는다
      const prev = lastBefore(segEnd);
      if (prev && !isLevelEv(prev)) pushDyn({ startBeat: segEnd + shift, kind: nearestLevel(velocityAt(srcDyn, segEnd - 1e-3)) });
    }
  });

  const { marks: _marks, ...rest } = score;
  void _marks;
  const out: Score = { ...rest, notes, chords };
  if (score.dynamics) out.dynamics = dynamics;
  return out;
}
