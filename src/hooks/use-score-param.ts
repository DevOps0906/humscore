"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getScoresSnapshot, saveScore, subscribeScores } from "@/lib/storage/scores";
import type { Score } from "@/lib/music/types";

/** 저장된 악보 목록 (서버 프리렌더 시점엔 null → 클라이언트에서 채워짐) */
export function useScores(): Score[] | null {
  return useSyncExternalStore(subscribeScores, getScoresSnapshot, () => null);
}

/**
 * id로 악보 한 건을 읽습니다 (/scores/[id]).
 * 반환값 score: undefined = 로딩 중, null = 없음
 */
export function useScore(id: string) {
  const scores = useScores();
  const score: Score | null | undefined = scores === null ? undefined : scores.find((s) => s.id === id) || null;

  const update = useCallback(
    (patch: Partial<Score>) => {
      if (score) void saveScore({ ...score, ...patch });
    },
    [score],
  );

  return { score, update };
}
