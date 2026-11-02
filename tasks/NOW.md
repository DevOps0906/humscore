# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-02
- 현재 작업: task-019 구현·리뷰 완료, 브랜치 feat/task-019-share-link(main 병합 시 CI가 운영 DB에 마이그레이션 자동 적용 → DB 통합 검증 V3 통과 전 병합 금지)
- 마지막으로 한 일: task-017 화면 사양 🟡 34→16(05_DATA_MODEL 테이블 목록 추가·데이터 칸 통일), task-018 랜딩 px 166→128줄(--lp-hairline·spacing calc, 3구간 캡처 비교로 변화 없음 확인)
- 다음 한 걸음: Docker 있는 환경(또는 원격 개발 브랜치 — 사용자 승인)에서 npm run db:start → SUPABASE_INTEGRATION=1 … npx vitest run src/lib/storage/__tests__/share-links-rls.integration.test.ts → 통과 시 main 병합
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: 없음(2026-11-02 task-004 진행·보컬 (나)·ISC·BSD-2 허용 결정). 대기: 사용자 실녹음 5~10곡(+가능하면 정답 .mid), iOS·Android 실측
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-019 검증(DB 통합 대기)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: docs/03_SCREENS_UX.md·05_DATA_MODEL.md·specs/task-002, design/, docs/diagrams/screen-data.mmd, src/components/landing/landing.module.css
- 테스트 상태: tsc·lint 통과, unit 668 통과·17 skip(통합 10건 NOT_RUN: Docker 없음). 리뷰: security 🟡2·code 🟡2 모두 반영
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
