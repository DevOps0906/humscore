import type { NoteEvent } from "./types";

/** 드럼 템플릿 예시 악보용 4/4 한 마디 패턴. 하이햇·킥·스네어 변주, 16분음표 필인, 쉼표 마디를 섞는다. */

const HAT = 42;
const OPEN = 46;
const KICK = 36;
const SNARE = 38;
const CRASH = 49;
const HIGH_TOM = 50;
const MID_TOM = 47;
const FLOOR_TOM = 43;

type Hit = [midi: number, at: number, duration: number];

const steps = (count: number, size: number) => Array.from({ length: count }, (_, i) => i * size);
const hats8 = (): Hit[] => steps(8, 0.5).map((at) => [HAT, at, 0.5]);
const hats16 = (): Hit[] => steps(16, 0.25).map((at) => [HAT, at, 0.25]);

/** 마디 종류. 각 항목은 한 마디(4박) 안의 (음, 시작 박, 길이) 목록 */
const GROOVES: Record<string, () => Hit[]> = {
  basic: () => [...hats8(), [KICK, 0, 0.5], [KICK, 2, 0.5], [SNARE, 1, 0.5], [SNARE, 3, 0.5]],
  crash: () => [[CRASH, 0, 0.5], ...hats8().slice(1), [KICK, 0, 0.5], [KICK, 2, 0.5], [SNARE, 1, 0.5], [SNARE, 3, 0.5]],
  kicks: () => [...hats8(), [KICK, 0, 0.5], [KICK, 1.5, 0.5], [KICK, 2, 0.5], [KICK, 3.5, 0.5], [SNARE, 1, 0.5], [SNARE, 3, 0.5]],
  openHat: () => [
    ...steps(4, 1).flatMap((at): Hit[] => [[HAT, at, 0.5], [OPEN, at + 0.5, 0.5]]),
    [KICK, 0, 0.5], [KICK, 2, 0.5], [KICK, 2.5, 0.5], [SNARE, 1, 0.5], [SNARE, 3, 0.5],
  ],
  sixteenth: () => [...hats16(), [KICK, 0, 0.25], [KICK, 0.75, 0.25], [KICK, 2, 0.25], [KICK, 2.5, 0.25], [SNARE, 1, 0.25], [SNARE, 3, 0.25]],
  fillSnare: () => [
    ...steps(4, 0.5).map((at): Hit => [HAT, at, 0.5]), [KICK, 0, 0.5], [SNARE, 1, 0.5],
    ...steps(4, 0.25).map((at): Hit => [SNARE, 2 + at, 0.25]),
    [HIGH_TOM, 3, 0.25], [HIGH_TOM, 3.25, 0.25], [MID_TOM, 3.5, 0.25], [FLOOR_TOM, 3.75, 0.25],
  ],
  fillToms: () => [
    [KICK, 0, 0.5], [SNARE, 1, 0.5],
    [SNARE, 2, 0.25], [SNARE, 2.25, 0.25], [HIGH_TOM, 2.5, 0.25], [HIGH_TOM, 2.75, 0.25],
    [MID_TOM, 3, 0.25], [MID_TOM, 3.25, 0.25], [FLOOR_TOM, 3.5, 0.25], [FLOOR_TOM, 3.75, 0.25],
  ],
  fillShort: () => [
    ...hats8().slice(0, 4), [KICK, 0, 0.5], [SNARE, 1, 0.5],
    [SNARE, 2, 0.25], [SNARE, 2.5, 0.25], [HIGH_TOM, 3, 0.25], [MID_TOM, 3.25, 0.25], [FLOOR_TOM, 3.5, 0.5],
  ],
  ending: () => [[CRASH, 0, 2], [KICK, 0, 2]],
  rest: () => [],
};

/** 20마디를 한 주기로 도는 구성. 4마디마다 필인, 8·16번째 마디는 쉼표 마디 */
const SEQUENCE = [
  "crash", "basic", "kicks", "fillSnare",
  "openHat", "sixteenth", "kicks", "rest",
  "crash", "openHat", "sixteenth", "fillShort",
  "kicks", "basic", "sixteenth", "rest",
  "crash", "kicks", "fillToms", "ending",
] as const;

/** 4/4 예시 마디의 음표(마디 시작 기준). 마지막 마디가 아니면서 구성표를 넘어서면 처음부터 다시 돈다. */
export function drumShowcaseMeasure(measure: number, measures: number): NoteEvent[] {
  const kind = measure === measures - 1 && measures >= 4 ? "ending" : SEQUENCE[measure % SEQUENCE.length];
  const name = kind === "ending" && measure !== measures - 1 ? "basic" : kind;
  return GROOVES[name]().map(([midi, at, durationBeats]) => ({ midi, startBeat: at, durationBeats }));
}
