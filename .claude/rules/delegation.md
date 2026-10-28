---
paths:
  - "src/**"
  - "supabase/**"
  - "e2e/**"
  - "docs/**"
---
# 위임·통합 규칙 (팀장이 코드·문서 작업을 배정할 때)
- 병렬 판단: 쓰기 영역 안 겹침 → 같은 트리 동시 실행 / 겹침 → `isolation: "worktree"` 후 팀장이 순서대로 병합 / 공유 계약 변경 → 병렬 금지 / 읽기 전용 → 언제든.
- 통합 흐름: 배정 전 `git status` 깨끗 → 완료 후 `npm run agents:check -- <에이전트명>` → `npm test` · `npx tsc --noEmit` → 위험도별 검증(보통 이상: codex-reviewer(code), Codex 불가 시 reviewer) → 팀장이 커밋(작업 1건 = 커밋 1개).
