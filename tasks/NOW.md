# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-05
- 현재 작업: task-024 완료 — 작곡하기 직접 열기, 음표·코드 클릭 편집, 기타 4종·별도 TAB 카드
- 마지막으로 한 일: 단위 797 통과·32 건너뜀, 프로덕션 E2E 45 통과·마우스 전용 모바일 1건 건너뜀. 기타/TAB 390·900·1440px 검수, 빠른 연속 클릭·터치·기존 드래그 회귀 보완. 커밋·main 푸시
- 다음 한 걸음: task-005 실기기 체크리스트(사용자) → 결과에 따라 task-016 임계값 조정. task-020 운영 마이그레이션은 검토 후 별도 배포
- 미확인: rAF 누수 수정은 코드로만(브라우저 실측 필요). OSMD 시스템 경계 단위(task-001)
- 열린 결정: task-004 실녹음 no-go 이후 재개 여부 · task-011 재계획. 스파이크 worktree(.claude/worktrees/agent-aa9849d89ba9916a9) 정리 여부
- 주의: 영역은 `.claude/rules/delegation.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
- SDLC 단계: task-024 구현·검증 완료. main 푸시 후 CI·Vercel 운영 배포 결과는 별도 확인
- 담당 모델/역할: Codex scout·builder·music-logic-coder·tester·codex-reviewer는 부모 모델·추론 설정 상속. 기존 Claude 위임 지시: Opus 기본, astra 금지
- 수정 파일: keys/score-client/welcome·composition-dialog·score-view·note-chord-editor·guitar-fretboard·tab-score-view·tablature·midi·instruments·keys-draft·단위/E2E·README·tasks. 새 의존성·DB·Score 모델 변경 없음. 기존 미추적 파일 보존
- task-022 검증: Vitest746 통과·32 건너뜀, 신규E2E10·기존회귀E2E12 통과, 3구간 PNG6장 검수. lint·tsc·코드리뷰·프로덕션빌드 확인. agents:check는 팀장 전용 types/tasks 및 기존로컬파일 탓 전체실패, 구현/테스트파일 통과
- 모델 결정: NoteEvent.lyrics 선택적 절별맵 추가, 기존 lyric=1절 호환. 서버스키마동기화, 기존JSONB/RLS유지·DB마이그레이션/새의존성 없음. iOS/Safari실음재생은 실기기확인 필요
- 디자인 검증: 1440·900·390px 전체 페이지 가로 넘침 없음, 이미지 4장 시각검수·파일 링크·git diff --check 확인. 화면·기능 코드는 변경하지 않음
- 설정 검증: TOML 파싱·역할 필수 필드·동시 실행 한도·AGENTS.md 80줄 제한·git diff --check 통과. Codex CLI 미설치로 실제 역할 로딩은 새 세션에서 확인 필요
- task-021 검증: Vitest 707 통과·32 건너뜀, lint·tsc·코드 리뷰 통과. 기능 E2E 6·스타일 적용 3구간 QA 2 통과, 완료/편집 12 PNG(.nomad) 중 6장 시각검수. agents:check는 기존 설정/주 에이전트 문서 변경 12건으로 전체 실패, 기능·테스트 파일은 영역 통과
- 테스트 상태: Vitest 697 통과·32 건너뜀, 로컬 Supabase setlist RLS 15 통과, 콘티 공유 E2E 1 통과, lint·tsc·production build 통과
- 남은 작업: 실기기: 말로 가사 입력(processLocally)·VOICE_* 상수 조정. 호환 로고 5개(Simple Icons 없음) 공식 파일 필요. 앱용 음성 인식 플러그인(새 의존성 승인). 실제 로그인(NEXT_PUBLIC_AUTH_MOCK=0). Docker http://localhost:3200, dev 3101
