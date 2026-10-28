"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

/** 현재 URL hash("#..." 또는 ""). 서버·하이드레이션 첫 렌더는 "". */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
}

/** 스크롤 없이 hash만 바꾸고 구독자에게 알린다(탭·아코디언 토글용). */
export function replaceHash(hash: string) {
  history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** 앵커 id를 실제 스크롤 대상으로 바꾼다. editor-<탭> 은 #editor 섹션으로. */
export function resolveAnchor(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (el) return el;
  if (id.startsWith("editor-")) return document.getElementById("editor");
  return null;
}

export function smoothScrollTo(el: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** hash로 이동: history에 쌓고, 구독자에게 알리고, 대상까지 부드럽게 스크롤. */
export function goToHash(hash: string) {
  const id = decodeURIComponent(hash.slice(1));
  if (window.location.hash !== hash) {
    history.pushState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  const el = resolveAnchor(id);
  if (el) smoothScrollTo(el);
}
