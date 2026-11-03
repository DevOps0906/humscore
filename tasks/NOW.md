# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-03
- 현재 작업: task-004 재개 — 1단계 B2(spike/real/melody.mjs)·2단계 분리(spike/sep) 실험 완료, 사용자 청취 판정 대기. 내 악보 → 음원 파일 진입 추가
- 마지막으로 한 일: 실녹음 2곡 A/B 청취 → no-go. cloud-sync e2e(OTP 코드 로그인) 통과·원격 메일 템플릿 형식(<strong> 코드)에 맞춤
- 다음 한 걸음: 사용자 청취(spike/real/out/*.B2.mid, spike/sep/out/*.wav·*.A.mid) → B2 본 구현 여부 결정 · 휴대폰 실측(task-005·016)
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: 없음. task-011 재계획은 나중에. 스파이크 worktree(.claude/worktrees/agent-aa9849d89ba9916a9) 정리 여부
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-019 완료(배포)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: e2e/cloud-sync.spec.ts, docs/specs/task-004-*, tasks/* (병합: docs/03_SCREENS_UX.md·05_DATA_MODEL.md, share_links 마이그레이션, landing.module.css)
- 테스트 상태: 병합 후 lint·tsc(next typegen 후)·unit 668 통과, 로컬 cloud-sync e2e 2 통과. 원격 기준 unit 668·PGlite 32/32, 로컬 cloud-sync e2e 2 통과(병합 전)
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
