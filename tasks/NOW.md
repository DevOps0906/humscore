# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-03
- 현재 작업: task-004 no-go 확정·기록(2026-11-03). task-011 보류. 스파이크 worktree(.claude/worktrees/agent-aa9849d89ba9916a9)는 정리 대상
- 마지막으로 한 일: cloud-sync e2e 수정(input-otp는 꽉 찬 값 위 fill 무시 → clear 먼저, 최근 수정 영역 때문에 링크 .first()). 2개 통과
- 다음 한 걸음: 실기기 실측(task-005 + 010-d + 008 + 014 가사·VOICE_* 상수) — 사용자 휴대폰 필요
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: 없음(task-004 중단). task-011 재계획 여부는 나중에
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 07 QA 완료 → 실기기 확인(가사 음성 인식·목소리 필터 상수)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: src/lib/audio/pitch-tracker.ts·offline-pitch.ts, public/worklets/hop-capture.js, src/lib/music/{segment,follow,types}.ts, src/app/(app)/record/page.tsx, src/hooks/use-follow-along.ts
- 테스트 상태: tsc·lint 통과, cloud-sync e2e(실제 로그인) 2 통과. 그 외는 10-29 기준 unit 636·e2e 69 통과
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
