# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-000 | NOMAD 적용 (팀 통합 · AGENTS.md · 영역 규칙) | W0 | — | 낮음 | 팀장 | 완료 |
| task-001 | 앱(Capacitor)에서 PDF 내보내기 — WebView `window.print()` 미동작 시 공유 시트 대체 | W1 | — | 보통 | builder → reviewer(code) | 대기 |
| task-002 | 공연 모드 보강 (범위는 착수 전 사용자 확정) | W1 | — | 보통 | builder → reviewer(design) | 대기 |
| task-003 | 클라우드 동기화 회귀 테스트 강화 (merge 단위 테스트 · 로그인 e2e 실행 조건) | W2 | — | 높음 | challenger → tester → reviewer(security) | 대기 |
| task-004 | 음원 파일 업로드 → 음표 변환 (Basic Pitch) | W3 | task-003 | 높음 | planner → challenger → builder | 대기 |
| task-005 | 실기기 체크리스트 수행 · 기록 (README 하단) | W1 | task-001 | 낮음 | 사용자 | 대기 |

상태: 대기 / 진행 / 완료 / 보류

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-10-28 | `.gitignore` | NOMAD 템플릿의 `.env.*`가 `.env.example`도 매칭 (추적 중이라 현재 무해) | NOMAD 템플릿에 `!.env.example` 추가 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 
