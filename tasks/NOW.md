# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-28
- 현재 작업: task-013 재디자인 — 랜딩 구현 완료, 내 악보(/library) 구현 대기
- 마지막으로 한 일: 공연 모드 따라 치기 — `src/lib/music/follow.ts`(buildFollowPlan·judge, 상수 FOLLOW_*), `src/hooks/use-follow-along.ts`, `src/components/follow-panel.tsx`, PianoKeyboard `compact`, pitch-tracker tick 정지 가드
- 다음 한 걸음: 실기기 실측(task-005 + 010-d) — 피아노 마이크 옥타브 오인식·같은 음 재타건·잔향, 앱 PDF, 동기화. 결과로 FOLLOW_* 상수 조정
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-002 범위, task-008 착수 여부, 토큰 감사 2·3·5번 승인 대기
- 주의: 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 06 구현 (랜딩 완료 → 내 악보)
- 담당 모델/역할: builder(Sonnet) · reviewer(Codex 한도로 대체)
- 수정 파일: src/app/(marketing)/**, src/components/landing/**, src/app/globals.css(레이아웃 토큰 4개)
- 테스트 상태: tsc·lint·unit 540 통과, e2e landing 4/4, 연동 수동 확인 OK
- 남은 작업: 내 악보 구현(시안 docs/design/redesign-library.html, 로그인은 UI mock·기존 Supabase 로그인 유지), 실제 허밍 샘플·캡처 교체. dev 서버는 3101(3100은 다른 프로젝트)
