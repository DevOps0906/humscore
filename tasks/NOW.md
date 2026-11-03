# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-03
- 현재 작업: task-020 찬양 콘티 완료 — C01 목록·C02 편집·C03 보기·공유·인쇄 및 `/s/[token]` 비로그인 읽기 경로
- 마지막으로 한 일: task-020 로컬 Supabase RLS 통합 15개·비로그인 공유 E2E 통과, Vitest 697개·lint·tsc·build 통과. README·작업 상태 갱신
- 다음 한 걸음: task-005 실기기 체크리스트(사용자) → 결과에 따라 task-016 임계값 조정. task-020 운영 마이그레이션은 검토 후 별도 배포
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-004 실녹음 no-go 이후 재개 여부 · task-011 재계획. 스파이크 worktree(.claude/worktrees/agent-aa9849d89ba9916a9) 정리 여부
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-019 완료(배포)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: task-020 콘티 화면·Server Actions·공유 조회·통합/E2E 테스트, README.md, tasks/*
- 테스트 상태: Vitest 697 통과·32 건너뜀, 로컬 Supabase setlist RLS 15 통과, 콘티 공유 E2E 1 통과, lint·tsc·production build 통과
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
