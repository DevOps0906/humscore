import { describe, expect, it } from "vitest";
import { buildScoreFromFrames } from "../pipeline";
import { midiToFreq } from "../frequency";
import type { Meter, PitchFrame } from "../types";
import { METERS } from "../meter";
import { MIC_TIMING, quantizeNotes } from "../quantize";
import type { RawNote } from "../types";

/** 시드 고정 난수(mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Mel = [number | null, number][];

interface GenOpts {
  seed?: number;
  /** 발성 시작 불안정 프레임 수(신뢰도 0.85 < minClarity). 기본 4 */
  onsetFrames?: number;
  /** true 면 불안정 프레임의 주파수까지 검출 못함(null) */
  onsetFreqLost?: boolean;
  /** 음 끝에서 성대가 먼저 멈추는 시간(초) */
  releaseSec?: number;
}

/** [midi|null, 박] -> 60fps 프레임. 비브라토 ±25센트(5.5Hz) + 시간·음정 지터 + 발성 시작 불안정 */
function synth(mel: Mel, bpm: number, o: GenOpts = {}): PitchFrame[] {
  const rand = rng(o.seed ?? 7);
  const spb = 60 / bpm;
  const dt = 1 / 60;
  const onsetFrames = o.onsetFrames ?? 4;
  const release = o.releaseSec ?? 0.04;
  const out: PitchFrame[] = [];
  let tStart = 0;
  for (const [midi, beats] of mel) {
    const tEnd = tStart + beats * spb;
    const first = Math.ceil(tStart / dt - 1e-9);
    const last = Math.ceil(tEnd / dt - 1e-9);
    for (let k = first; k < last; k++) {
      const t = k * dt + (rand() - 0.5) * 0.002;
      const idx = k - first;
      if (midi === null || tEnd - k * dt < release) {
        out.push({ time: t, freq: null, clarity: 0.15 + rand() * 0.1 });
        continue;
      }
      const vib = Math.sin(2 * Math.PI * 5.5 * (k * dt)) * 25 + (rand() - 0.5) * 10;
      const freq = midiToFreq(midi) * Math.pow(2, vib / 1200);
      if (idx < onsetFrames) {
        out.push(o.onsetFreqLost ? { time: t, freq: null, clarity: 0.5 } : { time: t, freq, clarity: 0.85 });
      } else {
        out.push({ time: t, freq, clarity: 0.93 + rand() * 0.06 });
      }
    }
    tStart = tEnd;
  }
  return out;
}

/** 재현 시퀀스: C D E F (쉼표) G F E D */
const SEQ: Mel = [[60, 2], [62, 1], [64, 0.5], [65, 0.5], [null, 1], [67, 4], [65, 1.5], [64, 0.5], [62, 2]];
const EXPECTED: [number | null, number][] = [[60, 2], [62, 1], [64, 0.5], [65, 0.5], [null, 1], [67, 4], [65, 1.5], [64, 0.5], [62, 2]];

function run(mel: Mel, bpm: number, beatsPerMeasure: number, o?: GenOpts) {
  const { score } = buildScoreFromFrames(synth(mel, bpm, o), { bpm, beatsPerMeasure, title: "t" });
  return score.notes.map((n) => [n.midi, n.durationBeats] as [number | null, number]);
}

/** 끝의 마디 채움 쉼표 제거 */
const trimTail = (r: [number | null, number][]) => (r.length && r[r.length - 1][0] === null ? r.slice(0, -1) : r);

describe("마이크 음가 보정: 템포·박자별 기대 음가", () => {
  for (const bpm of [60, 70, 90, 100, 120, 140, 160]) {
    for (const bpmeas of [3, 4]) {
      it(`${bpm}bpm, 마디당 ${bpmeas}박`, () => {
        expect(trimTail(run(SEQ, bpm, bpmeas))).toEqual(EXPECTED);
      });
    }
  }
});

describe("마이크 음가 보정: 발성 시작 변형", () => {
  for (const bpm of [60, 90, 120, 160]) {
    it(`발성 시작 6프레임, ${bpm}bpm`, () => {
      expect(trimTail(run(SEQ, bpm, 4, { onsetFrames: 6, seed: 3 }))).toEqual(EXPECTED);
    });
  }
  // 주파수까지 못 잡으면 8분음표(0.5박)의 유성 구간이 minNoteSec 아래로 줄어드는 160bpm 은 제외
  for (const bpm of [60, 90, 120, 140]) {
    it(`발성 시작 주파수까지 미검출, ${bpm}bpm`, () => {
      expect(trimTail(run(SEQ, bpm, 4, { onsetFreqLost: true, seed: 5 }))).toEqual(EXPECTED);
    });
  }
  it("시드가 달라도 같은 결과", () => {
    for (const seed of [1, 2, 11, 42, 99]) {
      expect(trimTail(run(SEQ, 120, 4, { seed }))).toEqual(EXPECTED);
    }
  });
});

describe("마이크 음가 보정: 쉼표 유지와 가짜 쉼표 제거", () => {
  it("빠른 템포(160)에서도 이어 부른 음 사이에 0.25박 이하 쉼표가 없다", () => {
    const r = run(SEQ, 160, 4);
    expect(r.filter(([m, d]) => m === null && d <= 0.25)).toEqual([]);
  });
  it("진짜 쉼표(1박)는 모든 템포에서 유지", () => {
    for (const bpm of [60, 90, 120, 160]) {
      const r = run([[60, 2], [null, 1], [62, 1]], bpm, 4);
      expect(r.slice(0, 3)).toEqual([[60, 2], [null, 1], [62, 1]]);
    }
  });
  it("첫 음 앞에 가짜 쉼표가 생기지 않는다 (120/160bpm)", () => {
    for (const bpm of [120, 160]) {
      expect(run([[60, 1], [62, 3]], bpm, 4)[0]).toEqual([60, 1]);
    }
  });
  it("같은 음을 다시 끊어 부른 반복음은 두 음으로 유지", () => {
    const mel: Mel = [[67, 1], [null, 0.5], [67, 1], [null, 0.5], [69, 1]];
    for (const bpm of [80, 120]) {
      const r = run(mel, bpm, 4).filter(([m]) => m !== null);
      expect(r.map(([m]) => m)).toEqual([67, 67, 69]);
    }
  });
});

describe("마이크 음가 보정: 6/8 은 3/4 와 같은 양자화 입력", () => {
  it("6/8 의 beatsPerMeasure(3) 가 3/4 와 같아 결과가 동일", () => {
    const m68 = METERS.find((m) => m.id === ("6/8" as Meter))!;
    const m34 = METERS.find((m) => m.id === ("3/4" as Meter))!;
    expect(m68.beatsPerMeasure).toBe(m34.beatsPerMeasure);
    for (const bpm of [60, 100, 120, 160]) {
      const a = run(SEQ, bpm, m34.beatsPerMeasure, { seed: 9 });
      const b = run(SEQ, bpm, m68.beatsPerMeasure, { seed: 9 });
      expect(b).toEqual(a);
      expect(trimTail(b)).toEqual(EXPECTED);
    }
  });
});

/** [midi|null, 박] -> RawNote. 시작은 delay 만큼 늦게, 끝은 release 만큼 일찍 감지 (프레임 단계 없이 양자화만 검증) */
function raws(mel: Mel, bpm: number, delay: number, release = 0.04): RawNote[] {
  const spb = 60 / bpm;
  const out: RawNote[] = [];
  let t = 0;
  for (const [midi, beats] of mel) {
    if (midi !== null) out.push({ midi, startSec: t + delay, endSec: t + beats * spb - release, meanCents: 0 });
    t += beats * spb;
  }
  return out;
}
const q = (mel: Mel, bpm: number, delay: number) =>
  quantizeNotes(raws(mel, bpm, delay), { bpm, beatsPerMeasure: 4, grid: 0.25, timing: MIC_TIMING });

describe("마이크 음가 보정 회귀: 고템포 격자 위치와 템포 비례 legato", () => {
  it("연속 16분음표 4개의 시작 위치 (120~160bpm, 지연 60ms)", () => {
    for (const bpm of [120, 140, 160]) {
      const r = q([[60, 0.25], [62, 0.25], [64, 0.25], [65, 0.25], [67, 1]], bpm, 0.06);
      expect(r.slice(0, 5).map((n) => n.startBeat)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    }
  });
  it("140bpm 8분+16분 패턴", () => {
    const r = q([[60, 0.5], [62, 0.25], [64, 0.25], [65, 0.5], [67, 0.5], [69, 2]], 140, 0.06);
    expect(r.slice(0, 6).map((n) => n.startBeat)).toEqual([0, 0.5, 0.75, 1, 1.5, 2]);
  });
  it("4분음표 사이 정확한 16분쉼표 유지 (90/120/160bpm)", () => {
    for (const bpm of [90, 120, 160]) {
      const r = q([[60, 0.75], [null, 0.25], [62, 1], [64, 2]], bpm, 0.0);
      expect(r.slice(0, 3).map((n) => [n.midi, n.startBeat, n.durationBeats])).toEqual([[60, 0, 0.75], [null, 0.75, 0.25], [62, 1, 1]]);
    }
  });
  it("발성 지연 60ms 가짜 쉼표는 여전히 제거 (60~160bpm)", () => {
    for (const bpm of [60, 90, 120, 160]) {
      const r = q([[60, 1], [62, 1], [64, 2]], bpm, 0.06);
      expect(r.filter((n) => n.midi === null && n.startBeat < 4)).toEqual([]);
      expect(r[0].durationBeats).toBe(1);
    }
  });
});
