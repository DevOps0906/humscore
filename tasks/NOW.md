# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-28
- 현재 작업: 랜딩·내 악보 재디자인 시안 — 상태: 사용자 확인 대기 (src 미반영)
- 마지막으로 한 일: 공연 모드 따라 치기 — `src/lib/music/follow.ts`(buildFollowPlan·judge, 상수 FOLLOW_*), `src/hooks/use-follow-along.ts`, `src/components/follow-panel.tsx`, PianoKeyboard `compact`, pitch-tracker tick 정지 가드
- 다음 한 걸음: 실기기 실측(task-005 + 010-d) — 피아노 마이크 옥타브 오인식·같은 음 재타건·잔향, 앱 PDF, 동기화. 결과로 FOLLOW_* 상수 조정
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-002 범위, task-008 착수 여부, 토큰 감사 2·3·5번 승인 대기
- 주의: 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 04 UI (03 UX 완료)
- 담당 모델/역할: codex-designer(UX) · planner(교차검토) · designer(HTML) · codex-reviewer(design·a11y)
- 수정 파일: docs/08_REDESIGN_BENCHMARK.md, docs/design/redesign-{ux.md,landing.html,library.html}, docs/diagrams/redesign-flow.{mmd,svg}, Design/shots/redesign-*.png (미커밋)
- 테스트 상태: mmd-check 통과, Codex 디자인 리뷰 🔴2 반영 완료(재리뷰 미실행)
- 남은 작업: 사용자 확인(비회원 보관함 접근·태블릿 세로 히어로 → 03 표·PRD 수정 여부) → 승인 시 builder로 src 반영 task 생성
