"use client";

import { useEffect } from "react";
import styles from "./landing.module.css";

/**
 * 스크롤 진입 fade-up. <html>에 .js를 붙여 [data-reveal]을 숨긴 뒤 화면에 들어오면 .in을 붙인다.
 * JS가 없거나 IntersectionObserver가 없으면 숨기지 않는다(콘텐츠는 항상 보임).
 */
export function Reveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add(styles.js);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add(styles.in);
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove(styles.js);
    };
  }, []);
  return null;
}
