# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-02
- 현재 작업: 없음. task-019 main 병합(운영 DB 마이그레이션은 CI db-migrate가 적용)
- 마지막으로 한 일: task-017 화면 사양 🟡 34→16(05_DATA_MODEL 테이블 목록 추가·데이터 칸 통일), task-018 랜딩 px 166→128줄(--lp-hairline·spacing calc, 3구간 캡처 비교로 변화 없음 확인)
- 다음 한 걸음: CI db-migrate 성공 확인 → 운영에서 공유 링크 수동 확인 · 다음 기능 찬양 콘티(PRD P1, 공유 링크 재사용) · 대기: task-015 음원, task-005 실기기
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: 없음(2026-11-02 task-004 진행·보컬 (나)·ISC·BSD-2 허용 결정). 대기: 사용자 실녹음 5~10곡(+가능하면 정답 .mid), iOS·Android 실측
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-019 완료(배포)
- 담당 모델/역할: builder·tester·music-logic-coder(Opus) → codex-reviewer(sol). 지시: 위임은 Opus 기본, astra 금지
- 수정 파일: docs/03_SCREENS_UX.md·05_DATA_MODEL.md·specs/task-002, design/, docs/diagrams/screen-data.mmd, src/components/landing/landing.module.css
- 테스트 상태: tsc·lint 통과, unit 668 통과, 공유 링크 SQL은 PGlite(Supabase 흉내)에서 32/32 통과. share-links-rls.integration.test.ts 10건은 Docker 환경에서 미실행
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
