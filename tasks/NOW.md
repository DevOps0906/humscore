# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-29
- 현재 작업: task-013 랜딩 v2(Klangio 벤치마크) 완료 · task-014 가사/음원 등록·체험(mock) 로그인 완료 — 사용자 확인 대기
- 마지막으로 한 일: 공연 모드 따라 치기 — `src/lib/music/follow.ts`(buildFollowPlan·judge, 상수 FOLLOW_*), `src/hooks/use-follow-along.ts`, `src/components/follow-panel.tsx`, PianoKeyboard `compact`, pitch-tracker tick 정지 가드
- 다음 한 걸음: 실기기 실측(task-005 + 010-d) — 피아노 마이크 옥타브 오인식·같은 음 재타건·잔향, 앱 PDF, 동기화. 결과로 FOLLOW_* 상수 조정
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-002 범위, task-008 착수 여부, 토큰 감사 2·3·5번 승인 대기
- 주의: 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 07 QA 완료 → 실기기 확인(가사 음성 인식·목소리 필터 상수)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: src/app/(marketing)/**, src/components/landing/**, src/lib/music/{lyrics,voice-filter}.ts, src/lib/storage/{auth-mock,scores}.ts, login, Dockerfile·compose
- 테스트 상태: tsc·lint·unit 573, e2e landing·login·score-lyrics-audio 통과. 모바일 score-dynamics 2건은 이전부터 실패(createScoreViaKeys 시간 초과, 미조사)
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
