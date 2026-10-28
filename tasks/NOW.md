# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-28
- 현재 작업: task-013 재디자인 — 랜딩·내 악보 구현 완료, Klangio형 랜딩 v2 시안 사용자 확인 대기
- 마지막으로 한 일: 공연 모드 따라 치기 — `src/lib/music/follow.ts`(buildFollowPlan·judge, 상수 FOLLOW_*), `src/hooks/use-follow-along.ts`, `src/components/follow-panel.tsx`, PianoKeyboard `compact`, pitch-tracker tick 정지 가드
- 다음 한 걸음: 실기기 실측(task-005 + 010-d) — 피아노 마이크 옥타브 오인식·같은 음 재타건·잔향, 앱 PDF, 동기화. 결과로 FOLLOW_* 상수 조정
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-002 범위, task-008 착수 여부, 토큰 감사 2·3·5번 승인 대기
- 주의: 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 04 UI (랜딩 v2 시안) — 06 구현은 승인 후
- 담당 모델/역할: designer(시안) → 승인 후 builder. 사용자 지시: 위임은 model opus 기본, Codex astra 금지
- 수정 파일: docs/design/redesign-landing-v2.html, docs/08_REDESIGN_BENCHMARK.md#6 (내 악보는 691f5f8로 커밋)
- 테스트 상태: 내 악보 tsc·lint·unit 540 통과, v2 시안 3구간 넘침 0·reduced-motion 정지 확인
- 남은 작업: v2 승인 → 랜딩 반영 + 신규 기능(오디오 파일 업로드 채보·피아노 롤·기타 TAB, 단선율·기기 내 처리). 실제 허밍 샘플·캡처 교체. dev 서버는 3101(3100은 다른 프로젝트)
