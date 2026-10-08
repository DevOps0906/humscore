# HumScore 에이전트 구조

## 설정 파일

| 파일 | 내용 |
|---|---|
| `.claude/settings.json` | `"model": "claude-opus-5-5"` (주 에이전트 = 팀장) |
| `CLAUDE.md` | 위임 규칙 + 프로젝트 제약 + 오디오 패턴 |

---

## 에이전트 6개 (`.claude/agents/`)

```
직급      에이전트            모델              effort   도구
──────────────────────────────────────────────────────────────────
팀장      (주 에이전트)       claude-opus-5-5   -        전체
자문위원  architect           claude-fable-5-1  high     Read·Glob·Grep·Bash
대리      feature-implementer claude-sonnet-5-5 medium   Read·Edit·Write·Glob·Grep·Bash
대리      music-logic-coder   claude-sonnet-5-5 medium   Read·Edit·Write·Glob·Grep·Bash
대리      tester              claude-sonnet-5-5 medium   Read·Edit·Write·Glob·Grep·Bash
대리      code-reviewer       claude-sonnet-5-5 medium   Read·Glob·Grep·Bash (읽기전용)
막내      file-finder         claude-haiku-5-5  low      Glob·Grep·Read (탐색전용)
```

---

## 호출 흐름

```
사용자 요청
    │
    ▼
팀장 (Opus 5.5) — 판단·조율
    ├─ 파일 위치 모를 때   → file-finder        (하이쿠, $0.10/$0.50)
    ├─ UI/기능 구현        → feature-implementer (소네트, $2/$10)
    ├─ 음악 알고리즘       → music-logic-coder   (소네트, $2/$10)
    ├─ 테스트 작성         → tester              (소네트, $2/$10)
    ├─ 코드 품질 검토      → code-reviewer       (소네트, $2/$10)
    └─ 2회 이상 막혔을 때  → architect           (페이블, $10/$50)
```

---

## 에이전트별 역할 요약

| 에이전트 | 모델 | 언제 쓰나 |
|---|---|---|
| `file-finder` | claude-haiku-5-5 | "이 함수 어디 있지?" — 위치 탐색만, 내용 읽지 않음 |
| `feature-implementer` | claude-sonnet-5-5 | 새 페이지·컴포넌트·훅 추가, Capacitor/Supabase 연동 |
| `music-logic-coder` | claude-sonnet-5-5 | `src/lib/music/` 안 순수 TS 알고리즘 수정 |
| `tester` | claude-sonnet-5-5 | Vitest 테스트 작성·실행, 실패 케이스 분석 |
| `code-reviewer` | claude-sonnet-5-5 | 버그·보안·엣지케이스 리뷰 (쓰기 권한 없음) |
| `architect` | claude-fable-5-1 | 오퍼스가 풀지 못한 아키텍처 문제 자문 (방향 제시만) |

---

## 비용 최적화 원칙

1. **먼저 하이쿠**: 파일 위치를 모를 때 `file-finder`로 경로 파악 → 찾은 후 소네트에 구현 위임
2. **소네트로 구현**: 대부분의 코딩 작업은 소네트(대리) 레벨
3. **오퍼스는 리뷰·판단**: 팀장은 결정과 검토에 집중
4. **페이블은 비상용**: 오퍼스가 2번 이상 시도 후 실패 시에만 호출

---

## 모델 비용표

| 직급 | 모델 | 입력 | 출력 |
|---|---|---|---|
| 팀장 | claude-opus-5-5 | $4 / M토큰 | $20 / M토큰 |
| 자문위원 | claude-fable-5-1 | $10 / M토큰 | $50 / M토큰 |
| 대리 | claude-sonnet-5-5 | $2 / M토큰 | $10 / M토큰 |
| 막내 | claude-haiku-5-5 | $0.10 / M토큰 | $0.50 / M토큰 |
