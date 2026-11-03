@AGENTS.md

# HumScore — 주 에이전트 지시 파일

> 팀 구성·모델·위임 규격은 전역 `~/.claude/nomad/TEAM.md`(NOMAD)를 따른다. 이 파일은 HumScore 고유 규칙만 적는다.
> 프로젝트 전용 팀원: `music-logic-coder`(src/lib/music/**). 나머지는 NOMAD v3.0 팀원(scout·intern·planner·codex-designer·designer·diagrammer·builder·tester·codex-reviewer·reviewer·challenger·advisor).
> 단계마다 `tasks/NOW.md`를 갱신한다.

## 병렬 작업 충돌 방지 (팀장 필독)
- 파일 소유권 표 · 병렬 판단 · 통합 흐름 · 부에이전트 공통 금지 → `.claude/rules/delegation.md` (src·supabase·e2e·docs·Design·public·ios·android 작업 때 로드). 배정 전 그 파일을 읽고, 위임 후 `npm run agents:check -- <팀원명>`.
