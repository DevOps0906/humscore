import { describe, expect, it } from "vitest";
import { playDrumNote } from "../percussion";

class Param {
  value = 0;
  events: [number, number][] = [];
  setValueAtTime(value: number, time: number) { this.events.push([value, time]); return this; }
  linearRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); return this; }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push([value, time]); return this; }
}

class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  type = "";
  buffer: unknown;
  loop = false;
  starts: number[] = [];
  stops: number[] = [];
  targets: unknown[] = [];
  disconnected = false;
  onended?: () => void;
  constructor(readonly kind: string) {}
  connect(target: unknown) { this.targets.push(target); return target; }
  disconnect() { this.disconnected = true; }
  start(time: number) { this.starts.push(time); }
  stop(time: number) { this.stops.push(time); }
}

function context() {
  const nodes: Node[] = [];
  const create = (kind: string) => { const node = new Node(kind); nodes.push(node); return node; };
  const destination = new Node("destination");
  const ctx = {
    sampleRate: 44100, destination,
    createGain: () => create("gain"),
    createOscillator: () => create("oscillator"),
    createBiquadFilter: () => create("filter"),
    createBufferSource: () => create("noise"),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  } as unknown as AudioContext;
  return { ctx, nodes, destination };
}

describe("타악기 음색과 노드 수명", () => {
  it("트라이앵글은 노이즈 대신 비정수 금속 배음을 사용하고 뮤트 시 잔향을 줄인다", () => {
    const open = context();
    const muted = context();
    playDrumNote(open.ctx, 81, 1);
    playDrumNote(muted.ctx, 80, 1);
    const tones = open.nodes.filter((node) => node.kind === "oscillator");
    expect(tones).toHaveLength(5);
    expect(open.nodes.some((node) => node.kind === "noise")).toBe(false);
    expect(tones[1].frequency.events[0][0] / tones[0].frequency.events[0][0]).toBeCloseTo(1.47);
    expect(Math.max(...muted.nodes.flatMap((node) => node.stops))).toBeLessThan(1.2);
    expect(Math.max(...open.nodes.flatMap((node) => node.stops))).toBeGreaterThan(3);
  });

  for (const midi of [36, 38, 49, 81]) {
    it(`타악기 ${midi}는 모든 소스가 끝난 뒤 전체 그래프를 해제한다`, () => {
      const { ctx, nodes } = context();
      playDrumNote(ctx, midi, 0);
      const sources = nodes.filter((node) => node.starts.length > 0);
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.stops).toHaveLength(1);
        expect(source.stops[0]).toBeGreaterThan(source.starts[0]);
      }
      sources.slice(0, -1).forEach((source) => source.onended?.());
      expect(nodes.every((node) => !node.disconnected)).toBe(true);
      sources.at(-1)?.onended?.();
      expect(nodes.every((node) => node.disconnected)).toBe(true);
    });
  }

  it("잘못된 번호·시각을 무시하고 속도와 음수 시각을 안전하게 제한한다", () => {
    const { ctx, nodes, destination } = context();
    for (const midi of [NaN, 34, 82, 36.5]) playDrumNote(ctx, midi, 0);
    playDrumNote(ctx, 36, Infinity);
    expect(nodes).toHaveLength(0);
    playDrumNote(ctx, 38, -2, { velocity: 99 });
    const output = nodes.find((node) => node.targets.includes(destination))!;
    expect(output.gain.events[0][0]).toBeLessThanOrEqual(0.5);
    for (const node of nodes) {
      for (const [value, time] of [...node.frequency.events, ...node.gain.events]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(time).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
