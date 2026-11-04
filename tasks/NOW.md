# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-04
- 현재 작업: README 4장 — 랜딩페이지 전체 디자인 본문 표시
- 마지막으로 한 일: 히어로 미리보기를 전체 페이지 이미지로 교체하고 접힘을 제거해 README에서 전체 디자인이 바로 보이도록 수정. 화면별 원본 링크 유지
- 다음 한 걸음: task-005 실기기 체크리스트(사용자) → 결과에 따라 task-016 임계값 조정. task-020 운영 마이그레이션은 검토 후 별도 배포
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-004 실녹음 no-go 이후 재개 여부 · task-011 재계획. 스파이크 worktree(.claude/worktrees/agent-aa9849d89ba9916a9) 정리 여부
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-021 구현·검증 완료. main 푸시 후 CI·Vercel 배포 결과는 별도 확인
- 담당 모델/역할: Codex scout·builder·music-logic-coder·tester·codex-reviewer는 부모 모델·추론 설정 상속. 기존 Claude 위임 지시: Opus 기본, astra 금지
- 수정 파일: README.md, tasks/NOW.md. 기존 디자인 PNG 재사용. .claude/settings.local.json·.serena는 제외
- 디자인 검증: 1440·900·390px 전체 페이지 가로 넘침 없음, 이미지 4장 시각검수·파일 링크·git diff --check 확인. 화면·기능 코드는 변경하지 않음
- 설정 검증: TOML 파싱·역할 필수 필드·동시 실행 한도·AGENTS.md 80줄 제한·git diff --check 통과. Codex CLI 미설치로 실제 역할 로딩은 새 세션에서 확인 필요
- task-021 검증: Vitest 707 통과·32 건너뜀, lint·tsc·코드 리뷰 통과. 기능 E2E 6·스타일 적용 3구간 QA 2 통과, 완료/편집 12 PNG(.nomad) 중 6장 시각검수. agents:check는 기존 설정/주 에이전트 문서 변경 12건으로 전체 실패, 기능·테스트 파일은 영역 통과
- 테스트 상태: Vitest 697 통과·32 건너뜀, 로컬 Supabase setlist RLS 15 통과, 콘티 공유 E2E 1 통과, lint·tsc·production build 통과
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
