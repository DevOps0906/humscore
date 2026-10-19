/**
 * Web MIDI 입력 (USB/블루투스 MIDI 건반). 음표 숫자와 시각만 다루며 오디오는 다루지 않는다.
 * requestMIDIAccess 는 반드시 사용자 제스처(버튼 클릭)에서 호출할 것.
 */

export type MidiEvent =
  | { type: "on"; midi: number; velocity: number; time: number }
  | { type: "off"; midi: number; time: number }
  | { type: "pedal"; down: boolean; time: number };

/** 파싱 결과 (시간 제외). velocity 는 0~1 */
export type ParsedMidi =
  | { type: "on"; midi: number; velocity: number }
  | { type: "off"; midi: number }
  | { type: "pedal"; down: boolean };

export const MIDI_UNSUPPORTED_MESSAGE =
  "이 브라우저는 MIDI 건반을 지원하지 않아요. PC·안드로이드의 Chrome 또는 Edge에서 사용해 주세요. (iPhone·iPad는 아직 지원하지 않아요)";
export const MIDI_DENIED_MESSAGE =
  "MIDI 사용 권한이 거부됐어요. 주소창의 사이트 설정에서 MIDI 접근을 허용한 뒤 다시 시도해 주세요.";

/** 원시 MIDI 바이트 → 음표/페달 이벤트. 관심 없는 메시지는 null. 모든 채널 허용. */
export function parseMidiMessage(data: ArrayLike<number>): ParsedMidi | null {
  if (!data || data.length < 2) return null;
  const status = data[0] & 0xf0;
  const d1 = data[1] & 0x7f;
  const d2 = data.length > 2 ? data[2] & 0x7f : 0;
  if (status === 0x90) {
    if (data.length < 3) return null;
    return d2 > 0 ? { type: "on", midi: d1, velocity: d2 / 127 } : { type: "off", midi: d1 };
  }
  if (status === 0x80) return { type: "off", midi: d1 };
  if (status === 0xb0 && d1 === 64) return { type: "pedal", down: d2 >= 64 };
  return null;
}

// ── 최소 Web MIDI 타입 (lib.dom 버전에 의존하지 않기 위해) ──
interface MidiMessageEventLike {
  data: Uint8Array | null;
  timeStamp: number;
}
interface MidiInputLike {
  id: string;
  name: string | null;
  state?: string;
  onmidimessage: ((e: MidiMessageEventLike) => void) | null;
}
interface MidiAccessLike {
  inputs: { forEach(cb: (input: MidiInputLike) => void): void };
  onstatechange: ((e: unknown) => void) | null;
}

export function isMidiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess === "function";
}

export type MidiConnectResult =
  | { ok: true; close: () => void }
  | { ok: false; reason: "unsupported" | "denied"; message: string };

export interface MidiConnectOptions {
  onEvent: (e: MidiEvent) => void;
  /** 연결된 입력 장치 이름 목록이 바뀔 때 (핫플러그 포함) */
  onDevices?: (names: string[]) => void;
}

/** MIDI 접근 요청 후 모든 입력 구독. 사용자 제스처 안에서 호출. */
export async function connectMidi(opts: MidiConnectOptions): Promise<MidiConnectResult> {
  if (!isMidiSupported()) return { ok: false, reason: "unsupported", message: MIDI_UNSUPPORTED_MESSAGE };
  let access: MidiAccessLike;
  try {
    access = await (navigator as unknown as { requestMIDIAccess(o: { sysex: boolean }): Promise<MidiAccessLike> }).requestMIDIAccess({ sysex: false });
  } catch {
    return { ok: false, reason: "denied", message: MIDI_DENIED_MESSAGE };
  }

  const handler = (e: MidiMessageEventLike) => {
    if (!e.data) return;
    const p = parseMidiMessage(e.data);
    if (p) opts.onEvent({ ...p, time: e.timeStamp } as MidiEvent);
  };

  let closed = false;
  const attach = () => {
    if (closed) return;
    const names: string[] = [];
    access.inputs.forEach((input) => {
      if (input.state && input.state !== "connected") return;
      input.onmidimessage = handler;
      names.push(input.name || "MIDI 장치");
    });
    opts.onDevices?.(names);
  };
  access.onstatechange = attach;
  attach();

  return {
    ok: true,
    close: () => {
      closed = true;
      access.onstatechange = null;
      access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    },
  };
}
