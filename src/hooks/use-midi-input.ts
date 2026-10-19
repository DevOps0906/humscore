"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectMidi, isMidiSupported, MIDI_UNSUPPORTED_MESSAGE, type MidiEvent } from "@/lib/audio/midi-input";

export type MidiStatus = "idle" | "connecting" | "connected" | "denied" | "unsupported";

export interface UseMidiInputOptions {
  /** 모든 MIDI 이벤트 (on/off/pedal, time = event.timeStamp) */
  onEvent?: (e: MidiEvent) => void;
  /** note-on 만 */
  onNote?: (midi: number, velocity: number, time: number) => void;
}

/** connect()는 버튼 클릭 핸들러에서 호출할 것 (사용자 제스처 필요). */
export function useMidiInput(options: UseMidiInputOptions = {}) {
  const [status, setStatus] = useState<MidiStatus>("idle");
  const [devices, setDevices] = useState<string[]>([]);
  const [lastNote, setLastNote] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(true);
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });
  const closeRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const t = setTimeout(() => setSupported(isMidiSupported()), 0);
    return () => {
      aliveRef.current = false;
      clearTimeout(t);
      closeRef.current?.();
      closeRef.current = null;
    };
  }, []);

  const connect = useCallback(async () => {
    if (closeRef.current) return;
    setStatus("connecting");
    setMessage("");
    const r = await connectMidi({
      onEvent: (e) => {
        optsRef.current.onEvent?.(e);
        if (e.type === "on") {
          setLastNote(e.midi);
          optsRef.current.onNote?.(e.midi, e.velocity, e.time);
        }
      },
      onDevices: (names) => aliveRef.current && setDevices(names),
    });
    if (!aliveRef.current) {
      if (r.ok) r.close();
      return;
    }
    if (r.ok) {
      closeRef.current = r.close;
      setStatus("connected");
    } else {
      setStatus(r.reason);
      setMessage(r.message);
    }
  }, []);

  return {
    supported,
    status,
    devices,
    connect,
    lastNote,
    message: !supported && !message ? MIDI_UNSUPPORTED_MESSAGE : message,
  };
}
