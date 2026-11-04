# AGENTS.md — HumScore

> 모든 AI 코딩 도구가 읽는 **단일 정본**. 80줄 이내. 영역 규칙은 `.claude/rules/*.md`, Claude 전용 팀 규칙은 `CLAUDE.md`.

## 1. 무엇인가
흥얼거리면 악보가 되는 앱 — 웹·iOS·Android를 한 코드베이스로. 오디오 패턴은 `.claude/rules/audio.md`.

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
- 마이크 음성 데이터(오디오) 저장·전송 금지 — 음표 숫자와, 사용자가 확인·적용한 가사 텍스트만 유지. 음성 인식은 기기 안(processLocally)만.
- 단일 데이터 모델 `Score`(`src/lib/music/types.ts`) — 변경은 팀장 결정.
- 새 의존성은 MIT·BSD-2·BSD-3·Apache-2.0·ISC만 (`secscan license`로 확인).
- UI는 반응형 3구간(~767 / 768~1199 / 1200~), 색·크기는 토큰만. 문서·커밋·화면 문구는 한국어.

## 5. 작업 방식
`tasks/README.md` 순서대로 하나씩, 재진입은 `tasks/NOW.md`. 커밋: `[task-NNN] 요약` + 본문(무엇을 · 확인 방법).

### Codex 멀티에이전트
- 독립적인 탐색·구현·검증은 부에이전트에 위임한다. 작은 수정·순서 의존 작업은 주 에이전트가 처리한다.
- 주 에이전트가 계획·공유 계약·통합을 맡고, `.codex/agents/*.toml`의 역할을 사용한다. 동시 부에이전트는 최대 3개.
- 배정 시 목적·쓰기 허용 파일·완료 기준을 명시하고 `.claude/rules/delegation.md`를 따른다. 기존 미커밋 변경은 보존한다.
- 같은 파일의 동시 수정과 공유 계약의 병렬 변경은 금지한다. 테스트 파일도 구현 담당과 소유권을 나눈다.
- 부에이전트 결과를 모두 회수하고 변경·검증을 확인한 뒤 완료 보고한다. git 변경·의존성·설정 수정은 주 에이전트만 수행한다.

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
