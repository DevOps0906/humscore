# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-000 | NOMAD 적용 (팀 통합 · AGENTS.md · 영역 규칙) | W0 | — | 낮음 | 팀장 | 완료 |
| task-001 | 앱(Capacitor)에서 PDF 내보내기 — WebView `window.print()` 미동작 시 공유 시트 대체 | W1 | — | 보통 | builder → reviewer(code) | 대기 |
| task-002 | 공연 모드 보강 (범위는 착수 전 사용자 확정) | W1 | — | 보통 | builder → reviewer(design) | 대기 |
| task-003 | 클라우드 동기화 회귀 테스트 강화 (merge 단위 테스트 · 로그인 e2e 실행 조건) | W2 | — | 높음 | challenger → tester → reviewer(security) | 대기 |
| task-004 | 음원 파일 업로드 → 음표 변환 (Basic Pitch) | W3 | task-003 | 높음 | planner → challenger → builder | 대기 |
| task-005 | 실기기 체크리스트 수행 · 기록 (README 하단) | W1 | task-001 | 낮음 | 사용자 | 대기 |
| task-006 | 건반 가로 고정(모바일·태블릿) · C4 중심 흰건반 15개 · 하단 탭바 높이 축소 | W1 | — | 높음(새 의존성) | builder → reviewer(code) | 완료 |
| task-007 | 피아노 교육 앱 벤치마킹 (`docs/06_BENCHMARK.md`) | W1 | — | 낮음 | 조사 | 완료 |
| task-008 | 빠른 패시지 인식 개선 (고정 hop 측정 · 세기 기반 온셋 · 최소 음 길이 0.06초) — 착수 여부 사용자 확인 | W2 | — | 보통 | music-logic-coder → tester → reviewer(code) | 대기 |
| task-009 | 기획 문서 (PRD · 화면 · 데이터 모델 · 경쟁 분석 · DESIGN.md · ADR 0001 유튜브 탭 캡처) | W1 | — | 낮음 | 팀장 | 완료 |

상태: 대기 / 진행 / 완료 / 보류

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-10-28 | `.gitignore` | NOMAD 템플릿의 `.env.*`가 `.env.example`도 매칭 (추적 중이라 현재 무해) | NOMAD 템플릿에 `!.env.example` 추가 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 
