import { measureOf, scoreMeasureCount } from "./edit";
import { hairpinTargets, levelAt } from "./dynamics";
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
  const origTargets = hairpinTargets(srcDyn);
  const copyOf = new Map<DynamicEvent, DynamicEvent>(); // 펼친 헤어핀 -> 원본 헤어핀

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
    if (srcDyn.length && entered && !here.some((d) => isLevelEv(d) && Math.abs(d.startBeat - m * bpm) < 1e-6)) {
      // 건너뛰어 들어온 마디는 그 자리의 셈여림 단계를 이어받는다 (첫 박에 단계 기호가 있으면 그것이 대신함)
      dynamics.push({ startBeat: m * bpm + shift, kind: levelAt(srcDyn, m * bpm) });
    }
    for (const d of here) {
      const copy = { ...d, startBeat: d.startBeat + shift };
      if (!isLevelEv(d)) copyOf.set(copy, d);
      dynamics.push(copy);
    }
  });

  // 펼친 뒤 헤어핀 목표가 원본과 달라지면(점프 지점의 단계 기호가 목표로 잡힘) 헤어핀 끝에 원래 목표 단계를 명시
  const outTargets = hairpinTargets(dynamics);
  const fixes: DynamicEvent[] = [];
  for (const [copy, orig] of copyOf) {
    const want = origTargets.get(orig);
    if (want && outTargets.get(copy) !== want) fixes.push({ startBeat: copy.startBeat + (copy.durationBeats ?? 0), kind: want });
  }
  if (fixes.length) {
    // 같은 박의 다른 기호보다 먼저 오도록 앞에 두고 박 기준 안정 정렬
    const merged = [...fixes, ...dynamics];
    merged.sort((a, b) => a.startBeat - b.startBeat);
    dynamics.length = 0;
    dynamics.push(...merged);
  }

  const { marks: _marks, ...rest } = score;
  void _marks;
  const out: Score = { ...rest, notes, chords };
  if (score.dynamics) out.dynamics = dynamics;
  return out;
}
