@AGENTS.md

# HumScore — 주 에이전트 지시 파일

> 팀 구성·모델·위임 규격은 전역 `~/.claude/nomad/TEAM.md`(NOMAD)를 따른다. 이 파일은 HumScore 고유 규칙만 적는다.
> 프로젝트 전용 팀원: `music-logic-coder`(src/lib/music/**). 나머지는 NOMAD v3.0 팀원(scout·intern·planner·codex-designer·designer·diagrammer·builder·tester·codex-reviewer·reviewer·challenger·advisor).
> SDLC 9단계·위험도별 검증·모델 한도 대응(`handoff`)도 TEAM.md를 따른다. 단계마다 `tasks/NOW.md`의 SDLC 단계·담당·수정 파일·테스트 상태를 갱신한다.

## 병렬 작업 충돌 방지 (팀장 필독)
- 파일 소유권 표 · 병렬 판단 · 통합 흐름 · 부에이전트 공통 금지 → `.claude/rules/delegation.md` (src·supabase·e2e·docs·Design·public·ios·android 작업 때 로드). 배정 전 그 파일을 읽고, 위임 후 `npm run agents:check -- <팀원명>`.
- 팀장 전용: `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `scripts/**`, `package.json`, lock 파일, config, git 작업 전부. 부에이전트는 git 상태 변경·의존성 변경 금지.
- **공유 계약**: `src/lib/music/types.ts`의 `Score`, `src/lib/audio/context.ts`의 공개 함수. 변경은 팀장 결정 → 한 에이전트 단독 실행.
