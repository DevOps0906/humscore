"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext } from "@/lib/audio/context";
import { playInstrumentNote, type InstrumentId } from "@/lib/audio/instruments";

/**
 * 악기 소리 재생 훅(기본 피아노). playNote는 반드시 사용자 제스처 핸들러 안에서 동기 호출할 것.
 * sustain 페달은 피아노에서만 의미가 있다.
 */
export function usePianoSound(instrument: InstrumentId = "piano") {
  const [sustain, setSustain] = useState(false);
  const sustainRef = useRef(sustain);
  const instrumentRef = useRef(instrument);
  useEffect(() => {
    sustainRef.current = sustain;
  }, [sustain]);
  useEffect(() => {
    instrumentRef.current = instrument;
  }, [instrument]);

  const playNote = useCallback((midi: number, opts: { duration?: number; velocity?: number } = {}) => {
    const ctx = getAudioContext(); // 제스처 안에서 동기 호출 (resume은 내부에서 fire-and-forget)
    const inst = instrumentRef.current;
    const doPlay = () =>
      playInstrumentNote(ctx, inst, midi, ctx.currentTime + 0.015, {
        sustainPedal: inst === "piano" ? sustainRef.current : false,
        ...opts,
      });
    if (ctx.state === "running") {
      doPlay();
    } else {
      const h = () => {
        if (ctx.state === "running") {
          ctx.removeEventListener("statechange", h);
          doPlay();
        }
      };
      ctx.addEventListener("statechange", h);
    }
  }, []);

  return { playNote, sustain, setSustain };
}
