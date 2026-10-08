"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getScoresSnapshot, saveScore, subscribeScores } from "@/lib/storage/scores";
import type { Score } from "@/lib/music/types";

const noopSubscribe = () => () => {};

/** 저장된 악보 목록 (서버 프리렌더 시점엔 null → 클라이언트에서 채워짐) */
export function useScores(): Score[] | null {
  return useSyncExternalStore(subscribeScores, getScoresSnapshot, () => null);
}

/**
 * 정적 export에서는 동적 라우트(/score/[id])가 빌드 시점에 정해져야 하므로
 * 사용자 악보는 쿼리스트링(/score/?id=...)으로 열고 브라우저에서 읽습니다.
 * 반환값: undefined = 로딩 중, null = 없음
 */
export function useScoreParam() {
  const id = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("id"),
    () => undefined,
  );
  const scores = useScores();
  const score: Score | null | undefined =
    id === undefined || scores === null ? undefined : (id && scores.find((s) => s.id === id)) || null;

  const update = useCallback(
    (patch: Partial<Score>) => {
      if (score) void saveScore({ ...score, ...patch });
    },
    [score],
  );

  return { score, update };
}
