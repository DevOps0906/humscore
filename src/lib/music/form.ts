import { measureOf, scoreMeasureCount } from "./edit";
import { levelAt } from "./dynamics";
import type { DynamicEvent, MeasureMarkKind, Score } from "./types";

/**
 * 도돌이표·D.C./D.S. 해석 (순수 함수).
 * Score.marks 를 따라가며 실제로 연주되는 마디 순서를 만든다.
 */

const DC_KINDS: MeasureMarkKind[] = ["dc", "dcAlFine", "dcAlCoda"];
const DS_KINDS: MeasureMarkKind[] = ["ds", "dsAlFine", "dsAlCoda"];

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

  const order: number[] = [];
  const repeated = new Set<number>();
  let jump: "none" | "fine" | "coda" | "plain" = "none";
  let jumped = false;
  let codaDone = false;
  let pos = 0;
  const limit = total * 6 + 16; // 각 기호는 최대 한 번씩만 작동하므로 정상 입력에선 닿지 않는 안전 상한

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

    if (has(pos, "repeatEnd") && !repeated.has(pos)) {
      repeated.add(pos);
      const target = starts.filter((s) => s <= pos);
      pos = target.length ? Math.max(...target) : 0;
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
    for (const c of score.chords) {
      if (inMeasure(c.startBeat, m)) chords.push({ ...c, startBeat: c.startBeat + shift });
    }
    const here = srcDyn.filter((d) => inMeasure(d.startBeat, m));
    const jumpedIn = k > 0 && order[k - 1] !== m - 1;
    if (srcDyn.length && (k === 0 ? m > 0 : jumpedIn) && !here.some((d) => Math.abs(d.startBeat - m * bpm) < 1e-6)) {
      // 건너뛰어 들어온 마디는 그 자리의 셈여림 단계를 이어받는다
      dynamics.push({ startBeat: m * bpm + shift, kind: levelAt(srcDyn, m * bpm) });
    }
    for (const d of here) dynamics.push({ ...d, startBeat: d.startBeat + shift });
  });

  const { marks: _marks, ...rest } = score;
  void _marks;
  const out: Score = { ...rest, notes, chords };
  if (score.dynamics) out.dynamics = dynamics;
  return out;
}
