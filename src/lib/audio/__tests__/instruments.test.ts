import { describe, expect, it } from "vitest";
import { INSTRUMENT_LABELS, INSTRUMENT_ORDER, isInstrumentId, playInstrumentNote } from "../instruments";
import { INSTRUMENT_ORDER as CATALOG_ORDER } from "../../music/instrument-catalog";

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
  disconnected = false;
  disconnect() { this.disconnected = true; }
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
  it("카탈로그 전체와 기타 5종의 재생 악기 라벨이 일치", () => {
    expect(INSTRUMENT_ORDER).toEqual(CATALOG_ORDER);
    expect(INSTRUMENT_ORDER).toEqual(expect.arrayContaining(["classicalGuitar", "acousticGuitar", "electricGuitar", "bassGuitar", "bassGuitar5"]));
    for (const id of INSTRUMENT_ORDER) {
      expect(INSTRUMENT_LABELS[id]).toBeTruthy();
      expect(isInstrumentId(id)).toBe(true);
    }
    expect(isInstrumentId("kazoo")).toBe(false);
  });

  for (const inst of INSTRUMENT_ORDER.filter((i) => i !== "piano")) {
    for (const midi of inst === "drumKit" ? [36, 38, 42, 49] : [48, 60, 69, 84]) {
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

  it("확장 음색은 피아노 대체음 없이 각각 다른 합성 설정을 사용한다", () => {
    const signatures = new Set<string>();
    for (const instrument of ["epRhodes", "epBell", "warmPad", "oboe", "harp", "marimba"] as const) {
      const { ctx, nodes } = makeCtx();
      playInstrumentNote(ctx, instrument, 60, 0, { duration: 0.8 });
      signatures.add(JSON.stringify(nodes.map((node) => ({ kind: node.kind, type: node.type, gain: node.gain.events, frequency: node.frequency.events, stop: node.stops }))));
      for (const source of nodes.filter((node) => node.starts.length)) source.onended?.();
      expect(nodes.every((node) => node.disconnected)).toBe(true);
    }
    expect(signatures.size).toBe(6);
  });

  it("팀파니 롤은 긴 음의 끝까지 타격을 예약한다", () => {
    const { ctx, nodes } = makeCtx();
    playInstrumentNote(ctx, "timpaniRoll", 48, 0, { duration: 8 });
    const starts = nodes.flatMap((node) => node.starts);
    expect(Math.max(...starts)).toBeGreaterThan(7.9);
    expect(Math.max(...starts)).toBeLessThan(8);
  });

  it("확장 음색의 velocity 0은 노드를 만들지 않는다", () => {
    const { ctx, nodes } = makeCtx();
    playInstrumentNote(ctx, "epRhodes", 60, 0, { velocity: 0 });
    expect(nodes).toHaveLength(0);
  });

  it("기타 4종은 같은 음높이를 유지하면서 서로 다른 배음과 엔벨롭을 쓴다", () => {
    const fingerprints = new Set<string>();
    for (const instrument of ["classicalGuitar", "acousticGuitar", "electricGuitar", "bassGuitar"] as const) {
      const { ctx, nodes } = makeCtx();
      playInstrumentNote(ctx, instrument, 45, 0, { duration: 0.4 });
      const oscillators = nodes.filter((node) => node.kind === "osc");
      expect(oscillators[0].frequency.events[0].v).toBeCloseTo(110);
      fingerprints.add(JSON.stringify(nodes.map((node) => ({ kind: node.kind, gain: node.gain.events, stop: node.stops }))));
    }
    expect(fingerprints.size).toBe(4);
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
