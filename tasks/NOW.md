# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-29
- 현재 작업: task-008 빠른 패시지 인식 완료(코드) — 실기기 확인 대기
- 마지막으로 한 일: task-008 — AudioWorklet 고정 hop 0.01s(public/worklets/hop-capture.js, 1.5초 시간 초과·미지원 시 rAF 폴백, AbortSignal 시작 취소)·PitchFrame.rms?·segment 시간 기준·세기 온셋(ONSET_*)·minNoteSec 0.06·follow 판정 *_SEC·record trace 10초
- 다음 한 걸음: 실기기 실측(task-005 + 010-d + 008) — iOS·앱 워클릿 로드 여부, 카운트인 지연, 박자·음표 위치, ONSET_RATIO·ONSET_MIN_RMS·FOLLOW_* 조정
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-002 범위, 토큰 감사 1번(CLAUDE.md 소유권 표 이동) 승인 대기
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: 07 QA 완료 → 실기기 확인(가사 음성 인식·목소리 필터 상수)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: src/lib/audio/pitch-tracker.ts·offline-pitch.ts, public/worklets/hop-capture.js, src/lib/music/{segment,follow,types}.ts, src/app/(app)/record/page.tsx, src/hooks/use-follow-along.ts
- 테스트 상태: tsc·lint·unit 596, e2e record 통과. codex-reviewer ACCEPT. 모바일 score-dynamics 2건은 이전부터 실패(미조사)
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
