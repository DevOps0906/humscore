"use client";

import { useCallback, useEffect, useState } from "react";
import { isInstrumentId, type InstrumentId } from "@/lib/audio/instruments";

const STORAGE_KEY = "humscore.instrument";

/** 선택 악기 (localStorage 저장). 하이드레이션 안전: 초기값 piano, 마운트 후 복원. */
export function useInstrument(): [InstrumentId, (v: InstrumentId) => void] {
  const [instrument, setInstrument] = useState<InstrumentId>("piano");

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (isInstrumentId(v)) setInstrument(v);
      } catch {
        /* 저장소 접근 불가 — 기본값 유지 */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const set = useCallback((v: InstrumentId) => {
    const next: InstrumentId = isInstrumentId(v) ? v : "piano";
    setInstrument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 무시 */
    }
  }, []);

  return [instrument, set];
}
