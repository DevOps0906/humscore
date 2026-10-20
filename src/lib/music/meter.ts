import type { Meter, Score } from "./types";

/** 선택 가능한 박자. beatsPerMeasure 는 내부 4분음표 수, beats/beatType 은 악보 표기 */
export const METERS: readonly { id: Meter; label: string; beatsPerMeasure: number; beats: number; beatType: number }[] = [
  { id: "3/4", label: "3/4", beatsPerMeasure: 3, beats: 3, beatType: 4 },
  { id: "4/4", label: "4/4", beatsPerMeasure: 4, beats: 4, beatType: 4 },
  { id: "6/8", label: "6/8", beatsPerMeasure: 3, beats: 6, beatType: 8 },
];

type MeterSource = Pick<Score, "beatsPerMeasure" | "meter">;

/** 악보 표기용 박자표. 6/8 이면 6/8, 그 외 beatsPerMeasure/4 */
export function timeSignatureOf(s: MeterSource): { beats: number; beatType: number } {
  if (s.meter === "6/8") return { beats: 6, beatType: 8 };
  return { beats: s.beatsPerMeasure, beatType: 4 };
}

/** 세 박자 중 하나면 그 id, 예전 데이터(2/4, 5/4 등)는 null */
export function meterOf(s: MeterSource): Meter | null {
  if (s.meter === "6/8" && s.beatsPerMeasure === 3) return "6/8";
  if (s.beatsPerMeasure === 3) return "3/4";
  if (s.beatsPerMeasure === 4) return "4/4";
  return null;
}

export function beatsPerMeasureOf(m: Meter): number {
  return METERS.find((x) => x.id === m)!.beatsPerMeasure;
}

/** 한 마디 안 메트로놈 클릭: at=4분음표 박 단위 위치, level 2=강박 1=중강 0=약 */
export function clickPattern(m: Meter): { at: number; level: 0 | 1 | 2 }[] {
  if (m === "3/4") return [{ at: 0, level: 2 }, { at: 1, level: 1 }, { at: 2, level: 1 }];
  if (m === "4/4") return [{ at: 0, level: 2 }, { at: 1, level: 1 }, { at: 2, level: 1 }, { at: 3, level: 1 }];
  return [
    { at: 0, level: 2 }, { at: 0.5, level: 0 }, { at: 1, level: 0 },
    { at: 1.5, level: 1 }, { at: 2, level: 0 }, { at: 2.5, level: 0 },
  ];
}

const NAMES: [number, string][] = [
  [4, "온"], [3, "점2분"], [2, "2분"], [1.5, "점4분"], [1, "4분"], [0.75, "점8분"], [0.5, "8분"], [0.25, "16분"],
];

/** 음가의 한국어 이름. 단일 음가가 아니면 "온+4분" 처럼 그리디로 나눠 "+" 연결 */
export function durationLabel(beats: number): string {
  const exact = NAMES.find(([v]) => Math.abs(v - beats) < 1e-6);
  if (exact) return exact[1];
  const parts: string[] = [];
  let left = Math.round(beats * 4) / 4;
  while (left > 1e-6) {
    const [v, name] = NAMES.find(([x]) => x <= left + 1e-6) ?? NAMES[NAMES.length - 1];
    parts.push(name);
    left -= v;
  }
  return parts.join("+");
}
