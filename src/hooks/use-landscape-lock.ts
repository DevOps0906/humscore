"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/** 데스크톱 구간 시작 폭(px) — 이 폭 이상이면 방향을 강제하지 않는다 */
const DESKTOP_MIN = 1200;

type WebOrientation = { lock?: (o: string) => Promise<void>; unlock?: () => void };

// 모듈 수준 참조 카운트: 마지막 사용처가 해제될 때만 unlock (StrictMode 이중 마운트·건반 2개 동시 마운트 대응)
let holders = 0;
let locked = false;
let attempt: Promise<void> | null = null;

function unlockNow() {
  if (!locked) return;
  locked = false;
  if (Capacitor.isNativePlatform()) void ScreenOrientation.unlock().catch(() => {});
  else {
    try {
      (screen.orientation as unknown as WebOrientation).unlock?.();
    } catch {
      // 무시
    }
  }
}

async function tryLock() {
  if (window.innerWidth >= DESKTOP_MIN) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await ScreenOrientation.lock({ orientation: "landscape" });
      locked = true;
    } else {
      const lock = (screen.orientation as unknown as WebOrientation | undefined)?.lock;
      if (typeof lock !== "function") return;
      await lock.call(screen.orientation, "landscape");
      locked = true;
    }
  } catch {
    // 미지원·구버전 앱(플러그인 없음)·전체 화면 아님: 안내 오버레이로 대체
  }
}

function acquire(): Promise<void> {
  holders++;
  attempt ??= tryLock().then(() => {
    attempt = null;
    if (holders === 0) unlockNow();
  });
  return attempt;
}

function release() {
  holders--;
  if (holders === 0) unlockNow(); // 시도가 진행 중이면 끝난 뒤 위 then 에서 해제
}

/**
 * 호출한 컴포넌트가 마운트된 동안만 화면을 가로로 잠근다(모바일·태블릿).
 * 네이티브는 Capacitor 플러그인, 웹은 screen.orientation.lock 을 시도(실패는 무시).
 * 잠금 시도가 끝난 뒤에도 세로로 남으면 needsRotate 가 true. dismiss 로 안내를 닫을 수 있다.
 */
export function useLandscapeLock(): { needsRotate: boolean; dismiss: () => void } {
  const [attempted, setAttempted] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    void acquire().then(() => {
      if (alive) setAttempted(true);
    });

    const update = () => {
      setPortrait(window.innerWidth < DESKTOP_MIN && window.matchMedia("(orientation: portrait) and (pointer: coarse)").matches);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      alive = false;
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      release();
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);
  return { needsRotate: attempted && portrait && !dismissed, dismiss };
}
