# AGENTS.md — HumScore

> 모든 AI 코딩 도구가 읽는 **단일 정본**. 80줄 이내. 영역 규칙은 `.claude/rules/*.md`, Claude 전용 팀 규칙은 `CLAUDE.md`.

## 1. 무엇인가
흥얼거리면 악보가 되는 앱 — 웹·iOS·Android를 한 코드베이스로. 상세 제약·오디오 패턴은 `CLAUDE.md`.

## 2. 스택
| 영역 | 선택 | 위치 |
|---|---|---|
| 웹·서버 | Next.js 16.4 (App Router·Server Actions) · React 19 · TypeScript · Tailwind CSS v4 | `src/` |
| 앱 | Capacitor 8 (운영 도메인 원격 로드) | `ios/` · `android/` |
| DB·인증 | Supabase (Postgres·RLS·Auth, `@supabase/ssr`) | `supabase/` |
| 음악 코어 | 순수 TS (브라우저 의존 없음) | `src/lib/music/` |

## 3. 명령 (패키지 관리자: npm)
| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` (포트 3100) |
| 린트 · 타입 | `npm run lint` · `npx tsc --noEmit` |
| 테스트 | `npm test` · `npm run test:e2e` |
| DB | `npm run db:start` · `npm run db:reset` |
| 영역 검사 | `npm run agents:check -- <팀원명>` |
| 앱 | `npm run cap:android` · `npm run cap:ios`(macOS) |
긴 출력 명령은 `~/.claude/nomad/bin/q <명령>`으로 실행한다.

## 4. 절대 규칙 (위반 = 리뷰 🔴)
- 비밀(service_role 등)은 저장소·클라이언트 번들·로그 금지. `.env.example`에 이름만.
- 모든 테이블 RLS. 적용된 마이그레이션은 수정하지 않고 새 파일로 추가.
- 마이크 음성 데이터 저장·전송 금지 (음표 숫자만 유지).
- 단일 데이터 모델 `Score`(`src/lib/music/types.ts`) — 변경은 팀장 결정.
- 새 의존성은 MIT·BSD-3·Apache-2.0만 (`secscan license`로 확인).
- UI는 반응형 3구간(~767 / 768~1199 / 1200~), 색·크기는 토큰만. 문서·커밋·화면 문구는 한국어.

## 5. 작업 방식
`tasks/README.md` 순서대로 하나씩, 재진입은 `tasks/NOW.md`. 커밋: `[task-NNN] 요약` + 본문(무엇을 · 확인 방법).

## 6. 영역 규칙
| 작업 경로 | 규칙 파일 |
|---|---|
| `src/**` · `public/**` | `.claude/rules/web.md` |
| `supabase/**` | `.claude/rules/db.md` |
| `docs/**` | `.claude/rules/docs.md` |
- 읽지 않는 파일: `.env*` · lock 파일 · `node_modules/` · `.next/` · `out/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
