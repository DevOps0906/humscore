---
paths:
  - "src/**"
  - "public/**"
---
# 웹 영역 규칙 (src/** 작업 때만 로드)
- 먼저 `~/.claude/skills/stack-nextjs/SKILL.md`를 읽는다.
- 화면은 `src/app/globals.css`의 `@theme` 토큰(정답)을 따른다.
- 상태(빈·로딩·오류·성공)를 spec대로 모두 구현하고, `shot <URL>`로 3구간(~767 / 768~1199 / 1200~)을 확인한다.
- 서버: Server Components · Server Actions(`src/app/actions/**`, zod 검증) · Supabase SSR 쿠키 인증(`src/proxy.ts`). `cacheComponents` 켜짐 → 사용자 데이터 읽기는 `<Suspense>` 안에서.
- `src/lib`: `music/`(순수 TS 음악 코어, 브라우저 의존 없음) · `audio/`(Web Audio) · `platform/`(웹/앱 차이 흡수) · `storage/`(로컬 저장 + Supabase 동기화).
- 전조는 `transpose` 값만 저장하고 출력 시 적용(원본 불변).
- 서버 전용 코드는 Server Components·`src/app/actions/**`(zod 검증)에만. 브라우저에서 LLM·결제·service_role을 직접 부르지 않는다.
