"use client";

import { useEffect } from "react";

/**
 * `/` → 랜딩(public/tono.html) 즉시 이동.
 *
 * - 정적 빌드(out/)에서는 scripts/landing-index.mjs 가 out/index.html 을 tono.html 로 덮어써
 *   이 컴포넌트가 아예 쓰이지 않습니다.
 * - 개발 서버·앱 내 Link 로 `/` 에 왔을 때만 이 컴포넌트가 렌더됩니다.
 *   첫 로드에서는 JS 번들 다운로드·하이드레이션을 기다리지 않도록 서버 HTML 에 인라인 스크립트로
 *   location.replace 를 넣어 HTML 파싱 중에 바로 이동합니다 ("이동 중…" 화면 깜빡임 제거).
 *   React 가 클라이언트에서 삽입한 <script> 는 실행되지 않으므로(클라이언트 라우팅으로 진입한 경우)
 *   useEffect 가 같은 이동을 보장합니다.
 */
const LANDING = "/tono.html";
const REDIRECT_SCRIPT = `if(location.pathname==="/"||location.pathname==="/index.html"){location.replace(${JSON.stringify(LANDING)}+location.search+location.hash)}`;

export default function RootRedirect() {
  useEffect(() => {
    window.location.replace(LANDING + window.location.search + window.location.hash);
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
      <noscript>
        <meta httpEquiv="refresh" content={`0;url=${LANDING}`} />
        <a href={LANDING}>HumScore 소개 페이지로 이동</a>
      </noscript>
    </>
  );
}
