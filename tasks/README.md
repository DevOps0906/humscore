# 작업 표

| 번호 | 제목 | 웨이브 | 선행 | 위험도 | 담당 | 상태 |
|---|---|---|---|---|---|---|
| task-000 | NOMAD 적용 (팀 통합 · AGENTS.md · 영역 규칙) | W0 | — | 낮음 | 팀장 | 완료 |
| task-001 | 앱(Capacitor)에서 PDF 내보내기 — 의존성 없는 이미지 PDF → 공유 시트 (실기기 확인은 task-005) | W1 | — | 보통 | builder → reviewer(code) | 완료 |
| task-002 | 공연 모드 보강 (범위는 착수 전 사용자 확정) | W1 | — | 보통 | builder → reviewer(design) | 완료 |
| task-003 | 클라우드 동기화 버그 수정 + 회귀 테스트 (계정 전환 유출 · 시계 지연 유실 · 로그아웃 경고 · 자동 재시도) | W2 | — | 높음 | challenger → builder → reviewer(code+security) | 완료 |
| task-004 | 음원 파일 업로드 → 음표 변환 (Basic Pitch) | W3 | task-003 | 높음 | planner → challenger → builder | 재개(2026-11-03 사용자 요청 — 1단계 멜로디 추적 후처리 · 2단계 음원 분리 스파이크, 3단계 서버 처리는 원칙 변경이라 별도 결정) |
| task-005 | 실기기 체크리스트 수행 · 기록 (README 하단) | W1 | task-001 | 낮음 | 사용자 | 대기 |
| task-006 | 건반 가로 고정(모바일·태블릿) · C4 중심 흰건반 15개 · 하단 탭바 높이 축소 | W1 | — | 높음(새 의존성) | builder → reviewer(code) | 완료 |
| task-007 | 피아노 교육 앱 벤치마킹 (`docs/06_BENCHMARK.md`) | W1 | — | 낮음 | 조사 | 완료 |
| task-008 | 빠른 패시지 인식 개선 (고정 hop 측정 · 세기 기반 온셋 · 최소 음 길이 0.06초) (실기기 확인은 task-005) | W2 | — | 보통 | music-logic-coder → tester → reviewer(code) | 완료 |
| task-009 | 기획 문서 (PRD · 화면 · 데이터 모델 · 경쟁 분석 · DESIGN.md · ADR 0001 유튜브 탭 캡처) | W1 | — | 낮음 | 팀장 | 완료 |
| task-010 | 따라 치기 연습 — 악보를 보며 피아노를 치면 마이크·MIDI로 다음 음 일치 판정·표시(단음부터, 학습 앱 구조 제외) | W2 | task-001 | 보통 | planner → music-logic-coder → builder → reviewer(code) | 완료 |
| task-011 | 외부 소리 실시간 받아 적기 (스피커 재생 음원 → 음표, 모바일 유튜브 대체 경로) | W3 | task-004 | 높음 | planner → challenger → builder | 대기(task-004 재개 결과에 따름. 같은 휴대폰 재생 캡처는 OS 제약으로 불가) |
| task-012 | 동기화 통합 검증 — 로컬 Supabase에서 RLS·LWW 트리거·2000개 제한·타인 id upsert + 실제 로그인 e2e(Mailpit OTP, 로컬 URL 가드, OTP 발송 한도 조정) | W2 | task-003 | 높음 | challenger → tester → reviewer(security) | 완료 |
| task-013 | 랜딩·내 악보 재디자인 반영 (시안 `docs/design/redesign-{landing,library}.html`, 비회원 기기 저장 배너·최근 수정 3개·검색·정렬·상태 4종, 태블릿 히어로 세로; 폴더·태그·복구 제외) | W2 | — | 보통 | codex-designer → designer → builder → codex-reviewer(design·code) | 완료 |
| task-014 | 악보 편집 '가사 등록'(기기 안 음성인식만, 음표별 lyric·MusicXML) · '음원 등록'(오디오 파일 업로드 + 악기 마이크 목소리 필터) | W2 | — | 보통 | music-logic-coder → builder → codex-reviewer(code) | 진행 |
| task-015 | task-004 실녹음 벤치 판정 — 사용자 음원 5~10곡(+정답 .mid)을 `spike/task-004` 브랜치 `spike/audio/`에 넣고 audio-bench 실행 → go/no-go, go면 본 구현 계획(challenger) | W3 | 사용자 음원 | 높음 | 팀장 → challenger | 완료(2026-11-03 사용자 2곡 청취 → no-go, task-004 중단) |
| task-016 | 실기기 결과 반영 — task-005 체크리스트 결과로 카운트인 지연·따라 치기 임계값(FOLLOW_*·ONSET_*)·VOICE_* 상수 조정 + 회귀 테스트 | W2 | task-005 | 보통 | music-logic-coder → builder → reviewer(code) | 대기 |
| task-017 | 화면 사양 🟡 정리 — 05_DATA_MODEL 표와 화면 표 데이터 칸 이름 맞추기(scores·share_links·youtube_sources·folders), 권장 구조는 반영 또는 비고에 사유 | W1 | — | 낮음 | planner → reviewer(doc) | 완료 |
| task-018 | 랜딩 CSS 남은 px 정리 — `landing.module.css` 아이콘·그림자·애니메이션 px를 --spacing 배수·--lp-* 변수로, 화면 변화 없음 | W1 | — | 낮음 | builder → reviewer(design) | 완료 |
| task-019 | 읽기 전용 공유 링크 (S01·S02) — 로그인 없이 보기·편집 불가·회수 가능, 찬양 콘티 선행 | W2 | task-003 | 높음 | planner → challenger → builder → reviewer(security) → tester | 완료(PGlite 통합 32/32, 로컬 Supabase 통합 테스트는 Docker 환경에서 추가 확인) |
| task-020 | 찬양 콘티(세트리스트) — C01 목록·C02 편집·C03 보기·공유·인쇄, share_links에 setlist_id (명세 `docs/specs/task-020-setlist.md`) | W2 | task-019 | 높음 | planner → challenger → builder → reviewer(security) | 완료(화면·서버·로컬 RLS·비로그인 E2E 검증, 운영 migration 대기) |
| task-021 | 건반 악보 입력 마치기·저장 시 빈 마디 정리와 마침줄 표시, 악보 편집 재개 시 마디 자동 확장 | W2 | — | 보통 | builder → tester → codex-reviewer(code) | 완료(Vitest 707 통과·32 건너뜀, 기능 E2E 6·3구간 QA 2 통과, lint·tsc·코드 리뷰 통과) |
| task-022 | 절별 가사(1~99)·선택 음표 위 코드·코드 진행과 마디 수에 따른 작곡·고급 리하모니제이션 ([명세](../docs/specs/task-022-composition.md)) | W2 | task-021 | 보통 | music-logic-coder → builder → tester → codex-reviewer(code) | 완료(Vitest 746 통과·32 건너뜀, 신규 E2E 10·기존 회귀 E2E 12 통과, 3구간 검수·lint·tsc·빌드 검증) |

| task-023 | 88건반 악보생성 문구·코드수정하기, 작곡 2-5-1·저장하기, 악보 4마디 줄 배치·마지막 줄 채우기 | W2 | task-022 | 보통 | builder → tester → codex-reviewer(code) | 완료(단위 750 통과·32 건너뜀, 기능·회귀 E2E 24개 통과, 3구간 폭·정렬 검사 및 시각 검수) |

| task-024 | 건반 작곡하기 직접 열기·클릭/터치 코드 편집, 기타 4종 입력·음색·별도 TAB 카드 | W2 | task-023 | 보통 | music-logic-coder → builder → tester → codex-reviewer(code) | 완료(단위 797 통과·32 건너뜀, 프로덕션 E2E 45 통과·마우스 전용 모바일 1건 건너뜀, 3구간 검수·린트·타입·빌드·리뷰 확인) |

| task-025 | 피아노·기타TAB·드럼·오케스트라 선택 단계와 악기별 합성 음색 모듈, 5현 베이스·오케스트라 타악·음색 저장 및 내보내기 | W2 | task-024 | 보통 | builder → music-logic-coder → tester → codex-reviewer | 완료(전체 단위 1508개 통과·32개 건너뜀, 선택·제목 E2E 5개 통과, 3구간 12 PNG·린트·타입·빌드·리뷰 확인, 실제 음색 청취는 실기기 확인 필요) |

| task-026 | 드럼 그림과 마디 구성·오케스트라 음색 버튼·내 악보 편집모드·크레딧 입력·화음/아르페지오 반주 10종 | W2 | task-025 | 보통 | builder → music-logic-coder → tester → codex-reviewer | 완료(단위1519개 통과·32개 건너뜀, desktop통합E2E33개 통과·신규UI/터치25개 통과·모바일 마우스드래그1개 건너뜀, 3구간12PNG·린트·타입·빌드·코드리뷰 확인) |

| task-027 | 베이스 음색 보강·악기별 독립 파트·기존 악보에 악기 추가·적용/저장 편집·드럼셋 연동·붙임줄/이음줄·참고 자료 기반 템플릿 설정 마법사·4마디 고정 폭/A4 출력 | W2 | task-026 | 높음(Score 파트 확장) | Codex | 완료(단위1540 통과·32 건너뜀, 프로덕션 E2E68 통과·최종 출력 보완 후26 통과, 3구간/PDF 2페이지 검수·린트·타입·빌드·리뷰 확인, 실기기 청취 별도) |

| task-028 | 좌우 템플릿 미리보기·빈 악보 생성/복원·제작자 개별 행·전체/개별 탭·기타/베이스 TAB 기본·하이햇 기둥·페이지 맞춤 | W2 | task-027 | 보통 | Codex | 완료(단위1551 통과·32 건너뜀, 관련 회귀57 통과·1건 건너뜀, 최종 프로덕션19 통과·1건 건너뜀, 3구간·PDF·린트·타입·빌드·리뷰 확인) |

| task-029 | 템플릿 4/4·8마디·중앙 미리보기·굵은 제목·베이스 TAB·찬송가 SATB와 1~4절 예시·성부 이름/음자리표 저장 | W2 | task-028 | 보통 | Codex | 완료(단위1559 통과·32 건너뜀, 프로덕션 템플릿 E2E12 통과, 3구간·출력 제목·린트·타입·빌드·리뷰 확인) |

| task-030 | 템플릿 시작 화면 글꼴·크기·굵기 설정, 드럼 악보 표기·드럼 세트 이미지, 레이아웃 보정 | W2 | task-029 | 보통 | Codex | 완료(단위1567 통과·32 건너뜀, 린트·타입 통과, task-030 E2E12 통과) |

| task-031 | 악기 제거·악보 합치기, 박자 2/4·2/2·12/8, 건반 누른 시간 음표 길이, 마이크 악기 선택·목소리 제외, 항목별 글자 크기, 템플릿 미리보기 개선, 랜딩 오선지 애니메이션 | W2 | task-030 | 큼 | Codex | 완료(단위1587 통과·린트·타입 통과, 관련 e2e 일부 기존 실패 남음, 유튜브 링크는 미구현) |

상태: 대기 / 진행 / 완료 / 보류

## 발견한 문제 (범위 밖 — 나중 작업 후보)
| 날짜 | 위치 | 내용 | 제안 |
|---|---|---|---|
| 2026-10-28 | `.gitignore` | NOMAD 템플릿의 `.env.*`가 `.env.example`도 매칭 (추적 중이라 현재 무해) | NOMAD 템플릿에 `!.env.example` 추가 |
| 2026-10-28 | `supabase/config.toml`·`supabase/templates/` | 로컬 메일 템플릿에 6자리 코드({{ .Token }})가 없어 e2e가 OTP 입력 대신 매직링크로 로그인. `email_sent=2`/시간이라 e2e는 시간당 1회만 가능 | 해결: magic_link·confirmation 템플릿(링크+코드)·email_sent 1000. `supabase stop`→`start` 후 e2e 실측 필요 |
| 2026-10-28 | `follow-panel.tsx` | 스펙 6장의 데스크톱(1200~) 우측 상태 패널 미구현(하단 패널로 대체). 판정 임계값(±50센트·3프레임·무음 5프레임)은 실측 전 초안 | 우측 패널 해결(ecf93c7). 임계값은 실기기 실측 후 조정 |

## 교훈 (다음 작업에 그대로 적용할 것만, 20줄 이내 유지)
- 
| 2026-10-29 | `src/components/landing/landing.module.css` | 히어로 장식 음표(.f1~.f5)·휴대폰 목업(.pscr·.prow) 글자 크기 px 리터럴 잔존, 섹션 패딩 px | 글자 크기·섹션 패딩 해결(6db6e4a). 아이콘·그림자·애니메이션 px 약 200곳은 미정 |
| 2026-10-29 | `src/lib/music/form.ts` 131-134 | unrollScore가 도돌이표·D.C.로 cresc/dim 중간 마디에 들어갈 때 levelAt만 써서 헤어핀 진행값을 잃을 수 있음(코드로만 확인, 미재현) | 해결: 구간 단위 닫힘(advisor 권고)으로 재작성. 경계 오차 최대 반 단계 |
| 2026-10-29 | `src/lib/storage/scores-mock.test.ts` | 전체 vitest 병렬 실행에서 "소유자가 있는 실제 계정 악보 숨김" 1회 실패, 단독·재실행 3회는 통과(플레이크) | 해결: 첫 동적 import 변환 시간이 5초 제한에 포함(beforeAll로 미리 로드) |
| 2026-10-29 | `src/lib/music/form.ts`·`edit.ts` | 편집기가 헤어핀 위에 다른 기호·헤어핀을 겹쳐 놓을 수 있음 → 펼칠 때 구간 경계 기울기가 원본과 다를 수 있음(미테스트) | 해결: 겹침 막기(setDynamic이 원본 반환)+테스트 4개. UI는 toast로 거부 안내 |
