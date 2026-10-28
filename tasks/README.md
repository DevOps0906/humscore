# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-000 | NOMAD 적용 (팀 통합 · AGENTS.md · 영역 규칙) | W0 | — | 낮음 | 팀장 | 완료 |
| task-001 | 앱(Capacitor)에서 PDF 내보내기 — 의존성 없는 이미지 PDF → 공유 시트 (실기기 확인은 task-005) | W1 | — | 보통 | builder → reviewer(code) | 완료 |
| task-002 | 공연 모드 보강 (범위는 착수 전 사용자 확정) | W1 | — | 보통 | builder → reviewer(design) | 대기 |
| task-003 | 클라우드 동기화 버그 수정 + 회귀 테스트 (계정 전환 유출 · 시계 지연 유실 · 로그아웃 경고 · 자동 재시도) | W2 | — | 높음 | challenger → builder → reviewer(code+security) | 완료 |
| task-004 | 음원 파일 업로드 → 음표 변환 (Basic Pitch) | W3 | task-003 | 높음 | planner → challenger → builder | 대기 |
| task-005 | 실기기 체크리스트 수행 · 기록 (README 하단) | W1 | task-001 | 낮음 | 사용자 | 대기 |
| task-006 | 건반 가로 고정(모바일·태블릿) · C4 중심 흰건반 15개 · 하단 탭바 높이 축소 | W1 | — | 높음(새 의존성) | builder → reviewer(code) | 완료 |
| task-007 | 피아노 교육 앱 벤치마킹 (`docs/06_BENCHMARK.md`) | W1 | — | 낮음 | 조사 | 완료 |
| task-008 | 빠른 패시지 인식 개선 (고정 hop 측정 · 세기 기반 온셋 · 최소 음 길이 0.06초) — 착수 여부 사용자 확인 | W2 | — | 보통 | music-logic-coder → tester → reviewer(code) | 대기 |
| task-009 | 기획 문서 (PRD · 화면 · 데이터 모델 · 경쟁 분석 · DESIGN.md · ADR 0001 유튜브 탭 캡처) | W1 | — | 낮음 | 팀장 | 완료 |
| task-010 | 따라 치기 연습 — 악보를 보며 피아노를 치면 마이크·MIDI로 다음 음 일치 판정·표시(단음부터, 학습 앱 구조 제외) | W2 | task-001 | 보통 | planner → music-logic-coder → builder → reviewer(code) | 완료 |
| task-011 | 외부 소리 실시간 받아 적기 (스피커 재생 음원 → 음표, 모바일 유튜브 대체 경로) | W3 | task-004 | 높음 | planner → challenger → builder | 대기 |
| task-012 | 동기화 통합 검증 — 로컬 Supabase에서 RLS·LWW 트리거·2000개 제한·타인 id upsert + 실제 로그인 e2e(Mailpit OTP, 로컬 URL 가드, OTP 발송 한도 조정) | W2 | task-003 | 높음 | challenger → tester → reviewer(security) | 완료 |
| task-013 | 랜딩·내 악보 재디자인 반영 (시안 `docs/design/redesign-{landing,library}.html`, 비회원 기기 저장 배너·최근 수정 3개·검색·정렬·상태 4종, 태블릿 히어로 세로; 폴더·태그·복구 제외) | W2 | — | 보통 | codex-designer → designer → builder → codex-reviewer(design·code) | 완료 |
| task-014 | 악보 편집 '가사 등록'(기기 안 음성인식만, 음표별 lyric·MusicXML) · '음원 등록'(오디오 파일 업로드 + 악기 마이크 목소리 필터) | W2 | — | 보통 | music-logic-coder → builder → codex-reviewer(code) | 진행 |

상태: 대기 / 진행 / 완료 / 보류

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-10-28 | `.gitignore` | NOMAD 템플릿의 `.env.*`가 `.env.example`도 매칭 (추적 중이라 현재 무해) | NOMAD 템플릿에 `!.env.example` 추가 |
| 2026-10-28 | `supabase/config.toml`·`supabase/templates/` | 로컬 메일 템플릿에 6자리 코드({{ .Token }})가 없어 e2e가 OTP 입력 대신 매직링크로 로그인. `email_sent=2`/시간이라 e2e는 시간당 1회만 가능 | OTP 템플릿 추가 + 로컬 한도 상향(팀장) |
| 2026-10-28 | `follow-panel.tsx` | 스펙 6장의 데스크톱(1200~) 우측 상태 패널 미구현(하단 패널로 대체). 판정 임계값(±50센트·3프레임·무음 5프레임)은 실측 전 초안 | 실기기 실측(task-010-d) 후 조정 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 
| 2026-10-29 | `src/components/landing/landing.module.css` | 히어로 장식 음표(.f1~.f5)·휴대폰 목업(.pscr·.prow) 글자 크기 px 리터럴 잔존, 섹션 패딩 px | 목업 전용 `--lp-*` 크기 변수로 토큰화 |
