"use client";

import { useSyncExternalStore } from "react";

export const WELCOME_KEY = "humscore.welcomed";

/** "pending" = 판정 전(서버/하이드레이션), "new" = 첫 실행, "seen" = 이미 봤음(또는 저장소 접근 불가) */
export type WelcomeStatus = "pending" | "new" | "seen";

const noopSubscribe = () => () => {};

function snapshot(): WelcomeStatus {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1" ? "seen" : "new";
  } catch {
    return "seen"; // 접근 실패 시 그냥 홈 표시
  }
}

export function useWelcomeStatus(): WelcomeStatus {
  return useSyncExternalStore(noopSubscribe, snapshot, () => "pending");
}

export function markWelcomed() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* 무시 */
  }
}
