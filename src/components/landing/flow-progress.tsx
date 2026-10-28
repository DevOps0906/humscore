"use client";

import { useEffect } from "react";
import styles from "./landing.module.css";

/**
 * 주요 기능 타임라인(#features-flow [data-flow]): 스크롤 진행을 --p(0~1)로 적고,
 * 기준선(화면 높이 60%)을 지난 [data-node]에 .lit을 붙인다. 움직임 줄이기면 끝 상태로 고정.
 */
export function FlowProgress() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-flow]");
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.style.setProperty("--p", "1");
      nodes.forEach((n) => n.classList.add(styles.lit));
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const mark = window.innerHeight * 0.6;
      const r = root.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (mark - r.top) / r.height));
      root.style.setProperty("--p", p.toFixed(4));
      for (const n of nodes) n.classList.toggle(styles.lit, n.getBoundingClientRect().top + n.offsetHeight / 2 <= mark);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return null;
}
