"use client";

import { useCallback, useEffect, useState } from "react";
import { SUSTAIN_DEFAULT, loadSustainRatio, setSustainRatio } from "@/lib/audio/sustain";

/** 지속음 길이 비율(슬라이더). 하이드레이션 안전: 초기값 기본, 마운트 후 저장값 복원. */
export function useSustainRatio(): [number, (value: number) => void] {
  const [ratio, setRatio] = useState(SUSTAIN_DEFAULT);
  useEffect(() => {
    const t = setTimeout(() => setRatio(loadSustainRatio()), 0);
    return () => clearTimeout(t);
  }, []);
  const set = useCallback((value: number) => setRatio(setSustainRatio(value)), []);
  return [ratio, set];
}
