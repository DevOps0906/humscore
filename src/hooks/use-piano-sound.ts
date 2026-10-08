"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext } from "@/lib/audio/context";
import { playPianoNote } from "@/lib/audio/piano-synth";

/** 피아노 소리 재생 훅. playNote는 반드시 사용자 제스처 핸들러 안에서 동기 호출할 것. */
export function usePianoSound() {
  const [sustain, setSustain] = useState(false);
  const sustainRef = useRef(sustain);
  useEffect(() => {
    sustainRef.current = sustain;
  }, [sustain]);

  const playNote = useCallback((midi: number, opts: { duration?: number; velocity?: number } = {}) => {
    const ctx = getAudioContext(); // 제스처 안에서 동기 호출 (resume은 내부에서 fire-and-forget)
    const doPlay = () =>
      playPianoNote(ctx, midi, ctx.currentTime + 0.015, { sustainPedal: sustainRef.current, ...opts });
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
