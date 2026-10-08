"use client";

import { useEffect } from "react";

export default function RootRedirect() {
  useEffect(() => {
    window.location.replace("/tono.html");
  }, []);

  return (
    <>
      <p className="py-10 text-center text-sm text-ink-soft">이동 중…</p>
      <noscript>
        <a href="/tono.html">HumScore 소개 페이지로 이동</a>
      </noscript>
    </>
  );
}
