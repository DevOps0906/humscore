@AGENTS.md

# HumScore — 주 에이전트 지시 파일

> 팀 구성·모델·위임 규격은 전역 `~/.claude/nomad/TEAM.md`(NOMAD)를 따른다. 이 파일은 HumScore 고유 규칙만 적는다.
> 프로젝트 전용 팀원: `music-logic-coder`(src/lib/music/**). 나머지는 NOMAD v3.0 팀원(scout·intern·planner·codex-designer·designer·diagrammer·builder·tester·codex-reviewer·reviewer·challenger·advisor).
> SDLC 9단계·위험도별 검증·모델 한도 대응(`handoff`)도 TEAM.md를 따른다. 단계마다 `tasks/NOW.md`의 SDLC 단계·담당·수정 파일·테스트 상태를 갱신한다.

## 병렬 작업 충돌 방지 규칙 (팀장 필독)

### ① 파일 소유권 — 각 에이전트는 자기 영역에만 쓴다

| 에이전트 | 쓰기 영역 |
|---|---|
| `music-logic-coder` | `src/lib/music/**` (단, `types.ts`는 팀장 승인 시에만) |
| `builder` | `src/app/**`, `src/proxy.ts`, `src/components/**`, `src/hooks/**`, `src/lib/{audio,platform,storage}/**`, `public/**`, `ios/**`, `android/**`, `supabase/**` |
| `tester` | 테스트 파일만 (`**/__tests__/**`, `**/*.test.ts`, `e2e/**`) |
| `planner` | `docs/**` (`docs/diagrams/**` 제외) |
| `codex-designer` | `docs/**`, `Design/**` (Codex `workspace-write`, 지시의 쓰기 허용 범위 안) |
| `designer` | `DESIGN.md`, `docs/design/**`, `Design/**`, `src/app/globals.css`의 `@theme` 토큰 (builder와 동시 배정 금지) |
| `diagrammer` | `docs/diagrams/**` |
| `intern` | 위임 지시의 "쓰기 허용" 경로만 — 검사는 그 경로 담당자 이름으로 |
| `scout`, `codex-reviewer`, `reviewer`, `challenger`, `advisor` | 읽기 전용 |
| **팀장 전용** | `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `scripts/**`, `package.json`, lock 파일, 각종 config(`*.config.*`, `tsconfig.json`), git 작업 전부 |

- 구현 에이전트는 자기 함수의 테스트 파일은 추가해도 된다. 영역 밖 수정이 필요하면 고치지 말고 보고서에 `요청: <파일> — <이유>`.
- **공유 계약**: `src/lib/music/types.ts`의 `Score`, `src/lib/audio/context.ts`의 공개 함수. 변경은 팀장 결정 → 한 에이전트 단독 실행.

### ② 병렬 판단 · ③ 통합 흐름
- 쓰기 영역 안 겹침 → 같은 트리 동시 실행 / 겹침 → `isolation: "worktree"` 후 팀장이 순서대로 병합 / 공유 계약 변경 → 병렬 금지 / 읽기 전용 → 언제든.
- 배정 전 `git status` 깨끗 → 완료 후 `npm run agents:check -- <에이전트명>` → `npm test` · `npx tsc --noEmit` → 위험도별 검증(보통 이상: codex-reviewer(code), Codex 불가 시 reviewer) → 팀장이 커밋(작업 1건 = 커밋 1개).

### 모든 부에이전트 공통 금지
- `git commit` / `push` / `branch` / `checkout` / `reset` 등 git 상태 변경
- `npm install` 등 의존성 변경 (`package.json`은 팀장 전용)
- 다른 에이전트 영역 파일 수정, 포매터로 전체 파일 일괄 재작성
