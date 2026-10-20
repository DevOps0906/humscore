import { describe, expect, it } from "vitest";
import { INSTRUMENT_LABELS, INSTRUMENT_ORDER, isInstrumentId, playInstrumentNote } from "../instruments";

/** 노드 생성·스케줄 호출을 기록하는 가짜 AudioContext */
class FakeParam {
  value = 0;
  isParam = true;
  events: { v: number; t?: number }[] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push({ v, t });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push({ v, t });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.events.push({ v, t });
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push({ v, t });
    return this;
  }
}

class FakeNode {
  kind: string;
  targets: unknown[] = [];
  starts: number[] = [];
  stops: number[] = [];
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  type = "";
  onended: (() => void) | null = null;
  buffer: unknown = null;
  loop = false;
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(t: unknown) {
    this.targets.push(t);
    return t;
  }
  disconnect() {}
  start(t: number) {
    this.starts.push(t);
  }
  stop(t: number) {
    this.stops.push(t);
  }
  setPeriodicWave() {}
}

function makeCtx() {
  const nodes: FakeNode[] = [];
  const mk = (kind: string) => {
    const n = new FakeNode(kind);
    nodes.push(n);
    return n;
  };
  const destination = new FakeNode("destination");
  const ctx = {
    sampleRate: 44100,
    currentTime: 0,
    destination,
    createGain: () => mk("gain"),
    createOscillator: () => mk("osc"),
    createBiquadFilter: () => mk("biquad"),
    createBufferSource: () => mk("bufsrc"),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createPeriodicWave: () => ({}),
  };
  return { ctx: ctx as unknown as AudioContext, nodes, destination };
}

const GAIN_LIMIT = 1; // 엔벨롭·믹스 단계 개별 gain 목표값 상한
const OUTPUT_LIMIT = 0.5; // destination 직전 gain 상한

describe("instruments", () => {
  it("순서·라벨이 9종 모두 존재", () => {
    expect(INSTRUMENT_ORDER).toHaveLength(9);
    for (const id of INSTRUMENT_ORDER) {
      expect(INSTRUMENT_LABELS[id]).toBeTruthy();
      expect(isInstrumentId(id)).toBe(true);
    }
    expect(isInstrumentId("kazoo")).toBe(false);
  });

  for (const inst of INSTRUMENT_ORDER.filter((i) => i !== "piano")) {
    for (const midi of [48, 60, 69, 84]) {
      for (const duration of [undefined, 0.3, 2]) {
        it(`${inst} midi ${midi} duration ${duration ?? "none"}`, () => {
          const { ctx, nodes, destination } = makeCtx();
          expect(() => playInstrumentNote(ctx, inst, midi, 0.5, { velocity: 1, duration })).not.toThrow();

          const sources = nodes.filter((n) => n.kind === "osc" || n.kind === "bufsrc");
          expect(sources.length).toBeGreaterThan(0);
          for (const s of sources) {
            expect(s.starts.length).toBe(1);
            expect(s.stops.length).toBe(1);
            expect(s.stops[0]).toBeGreaterThanOrEqual(s.starts[0]);
          }

          let maxGain = 0;
          let maxOutput = 0;
          for (const n of nodes) {
            const params = [n.gain, n.frequency, n.detune, n.Q];
            for (const p of params) {
              for (const e of p.events) {
                expect(Number.isNaN(e.v)).toBe(false);
                if (e.t !== undefined) {
                  expect(Number.isNaN(e.t)).toBe(false);
                  expect(e.t).toBeGreaterThanOrEqual(0);
                }
              }
            }
            if (n.kind !== "gain") continue;
            // LFO 깊이(센트) 게인은 detune 파라미터로 가므로 제외
            if (n.targets.some((t) => (t as FakeParam).isParam)) continue;
            const m = Math.max(0, ...n.gain.events.map((e) => e.v));
            maxGain = Math.max(maxGain, m);
            if (n.targets.includes(destination)) maxOutput = Math.max(maxOutput, m);
          }
          expect(maxGain).toBeLessThanOrEqual(GAIN_LIMIT);
          expect(maxOutput).toBeLessThanOrEqual(OUTPUT_LIMIT);
        });
      }
    }
  }

  it("나이퀴스트 근처 음은 조용히 무시(throw 없음)", () => {
    const { ctx } = makeCtx();
    for (const inst of INSTRUMENT_ORDER) {
      expect(() => playInstrumentNote(ctx, inst, 135, 0)).not.toThrow();
    }
  });

  it("NaN/음수 입력에도 NaN 시각을 만들지 않음", () => {
    for (const inst of INSTRUMENT_ORDER.filter((i) => i !== "piano")) {
      const { ctx, nodes } = makeCtx();
      expect(() => playInstrumentNote(ctx, inst, 60, -1, { duration: NaN, velocity: NaN })).not.toThrow();
      for (const n of nodes) {
        for (const t of [...n.starts, ...n.stops]) {
          expect(Number.isNaN(t)).toBe(false);
          expect(t).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
