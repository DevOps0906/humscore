# 03. 신규·개선 화면 (경쟁 분석 반영)

> 근거: [07_COMPETITORS.md](07_COMPETITORS.md)#3 · [06_BENCHMARK.md](06_BENCHMARK.md)#4. 유튜브 결정은 [adr/0001-youtube-tab-capture.md](adr/0001-youtube-tab-capture.md), 흐름은 [diagrams/youtube-capture-flow.mmd](diagrams/youtube-capture-flow.mmd).
> 기존 화면(record·keys·scores/[id]·perform·welcome·login)은 이 문서 범위 밖. API 열의 `미정`은 04_API 작성 전.
> 반응형: 모바일 ~767 / 태블릿 768~1199 / 데스크톱 1200~. 구간별 차이는 `## 반응형` 표.

## 화면
| ID | 화면 | 유형 | 경로 | 주된 일 | 구성 | 데이터 | API | 권한 | 다음 |
|---|---|---|---|---|---|---|---|---|---|
| L01 | 랜딩 개편 | 랜딩 | / | 허밍 시작 유도 | header, hero:한 줄 가치+실제 허밍→악보 15초 영상+샘플 악보, button:지금 흥얼거려 보기, card:후기·사용자 수(미확인), pricing, faq, footer | — | 미정 | 누구나 | record, PR01 |
| Y01 | 유튜브 링크 입력 | 폼 | /import/youtube | 링크 넣고 시작 | header, breadcrumb, form:유튜브 링크*, text:저작권·기기 안 처리 안내, button:다음, link:취소 | youtube_sources | 미정 | 로그인 | Y02 |
| Y02 | 탭 캡처 안내·진행 | 마법사 | /import/youtube/capture | 새 탭 재생→탭 오디오 공유→변환 | header, steps:링크 확인·새 탭에서 재생·탭 공유 선택·변환 중, text:단계별 안내, button:이전, button:다음, button:취소 | — (오디오 저장 안 함) | 미정 | 로그인 | Y03, Y01 |
| Y03 | 결과 악보 | 상세 | /import/youtube/result | 변환 결과 확인 후 편집 | header, breadcrumb, text:제목·출처 링크, card:악보 미리보기, text:정확도 한계 안내, button:편집하기, button:저장, button:다시 변환 | scores, youtube_sources | 미정 | 로그인 | scores/[id], Y01 |
| P01 | 악보 연습 바 | 상세 | /scores/[id] (하단 바) | 구간 반복·속도로 연습 | header, card:악보, tabs:재생·연습, form:구간 시작·구간 끝, form:속도 50~100%, button:재생, button:반복 켜기 | scores | 미정 | 로그인 | perform |
| S01 | 공유 악보 보기 | 상세 | /s/[token] | 읽기 전용 악보 보기·재생 | header, text:제목·만든이 표시 여부, card:악보, button:재생, link:HumScore로 만들어 보기, footer | share_links, scores | 미정 | 링크 소지자 | L01 |
| S02 | 공유 설정 | 설정 | /scores/[id]/share | 링크 만들기·끄기 | header, breadcrumb, form:공유 켜기*·만료일, text:공유 링크, button:링크 복사, button:공유 끄기 | share_links | 미정 | 로그인(소유자) | scores/[id] |
| B01 | 내 악보 | 목록 | /library | 악보 찾고 정리 | header, search, filter:폴더·태그, sort:최근·제목·수정일, list:악보 카드, pagination, button:새 폴더, button:악보 만들기 | scores, folders, tags | 미정 | 로그인 | scores/[id], record |
| PR01 | 요금 안내(Pro) | 랜딩 | /pricing | 무료·Pro 차이 확인 | header, hero:허밍은 무료, pricing:무료·Pro(가격 미확인), faq, button:사전 알림 받기, footer | — | 미정 | 누구나 | L01, record |
| C01 | 콘티 목록 | 목록 | /setlists | 찬양 콘티 찾기 | header, search, sort:최근(예배일 내림차순), list:날짜·예배명·곡 수, pagination, button:새 콘티 | setlists | 미정 | 로그인 | C02, C03 |
| C02 | 콘티 편집 | 폼 | /setlists/[id]/edit | 곡 순서·키·진행 정하기 | header, breadcrumb, form:예배명*·예배일*·메모, list:곡(곡명·키 전조·템포·진행 순서 문자열·메모·위/아래 버튼·드래그 핸들), button:곡 추가, text:곡 사이 전환 메모, text:인도자 멘트, button:저장, link:취소 | setlists, setlist_items, scores | 미정 | 로그인(소유자) | C03, C01 |
| C03 | 콘티 보기·공유 | 상세 | /setlists/[id] · /s/[token] | 팀원에게 공유·인쇄 | header, breadcrumb, table:순서·곡명·키·템포·진행, text:전환 메모·멘트, button:공유 링크 복사, button:공유 끄기, button:A4 인쇄, button:공연 모드 | setlists, setlist_items, share_links | 미정 | 소유자(편집·공유) / 링크 소지자(읽기) | C04, C02 |
| C04 | 콘티 공연 모드 | 상세 | /setlists/[id]/perform | 곡을 이어서 넘기며 인도 | header, card:현재 곡 악보, text:다음 곡 제목·키(미리보기), text:전환 메모, button:이전 곡, button:다음 곡, link:나가기 | setlist_items, scores | 미정 | 소유자·링크 소지자 | C03 |

## 상태
| ID | 빈 | 로딩 | 오류 | 성공 |
|---|---|---|---|---|
| L01 | — | 영상 포스터 먼저 표시 | 영상 실패 시 샘플 악보 이미지만 | — |
| Y01 | 링크 입력 전 예시 안내 | 링크 확인 중 | 유튜브 링크 형식 아님·재생 불가 영상 안내 | 링크 확인됨 → Y02 |
| Y02 | 탭 공유 전 단계 안내 | 변환 중 진행 표시(기기 안) | 미지원 브라우저·공유 취소·탭 오디오 없음·무음 감지 안내 | 변환 완료 → Y03 |
| Y03 | 인식된 음 없음 + 다시 변환 | 악보 그리는 중 | 저장 실패 다시 시도 | 저장됨 → 편집 |
| P01 | 악보 음표 없음 시 비활성 | 오디오 준비 중 | 오디오 시작 실패 안내 | 구간 반복 중 표시 |
| S01 | — | 악보 스켈레톤 | 링크 만료·해제·없음(동일 안내, 존재 여부 비노출) | — |
| S02 | 공유 꺼짐 상태 안내 | 링크 생성 중 | 생성 실패 다시 시도 | 링크 복사됨 |
| B01 | 악보 없음 + 허밍 시작 버튼 / 검색 결과 없음 | 목록 스켈레톤 | 다시 시도 | 폴더·태그 저장됨 |
| PR01 | — | — | — | 사전 알림 등록됨 |
| C01 | 콘티 없음 + 새 콘티 버튼 / 검색 결과 없음 | 목록 스켈레톤 | 다시 시도 | 삭제·생성됨 안내 |
| C02 | 곡 없음 + 곡 추가 안내 | 저장 중 표시 | 저장 실패 다시 시도·삭제된 악보 표시 | 저장됨 |
| C03 | 곡 없는 콘티 안내 | 표 스켈레톤 | 링크 만료·해제·없음(동일 안내) | 링크 복사됨 |
| C04 | 곡 없음 시 진입 불가 안내 | 악보 준비 중 | 악보 불러오기 실패 다시 시도 | 마지막 곡 끝 안내 |

## 반응형
| ID | 모바일 ~767 | 태블릿 768~1199 | 데스크톱 1200~ |
|---|---|---|---|
| L01 | 1열, 영상 위·악보 아래, CTA 하단 고정 | 2열(문구/영상) | 2열 + 후기 3열 카드 |
| Y01~Y03 | 1열 마법사, 단계 상단 요약 | 중앙 카드 | 좌 안내·우 미리보기 |
| P01 | 하단 바(구간·속도 접이식) | 하단 바 전체 노출 | 악보 옆 고정 패널 |
| S01~S02 | 1열, 악보 가로 스크롤 | 1열 넓게 | 중앙 폭 제한 |
| B01 | 카드 1열, 필터는 시트 | 카드 2열, 필터 상단 | 사이드 폴더 + 카드 3열 |
| PR01 | 요금 카드 세로 | 가로 2카드 | 가로 + FAQ 2열 |
| C01 | 카드 1열 | 카드 2열 | 표형 목록 |
| C02 | 곡 카드 세로, 드래그 대신 위/아래 버튼 | 드래그+버튼, 곡 카드 1열 | 좌 곡 목록(드래그)·우 곡 상세 편집 |
| C03 | 1열 요약, 인쇄는 A4 고정 레이아웃 | 1열 넓게 | 중앙 폭 제한 |
| C04 | 악보 전체 화면, 다음 곡 키 상단 띠 | 악보+하단 띠 | 악보+우측 다음 곡 패널 |
- 폰트 크기는 구간별 토큰으로 지정(`src/styles` 토큰 파일 정답, 값은 여기서 정하지 않음).

## 흐름
| ID | 흐름 | 단계 |
|---|---|---|
| F-Y | 유튜브 → 악보 | Y01 → Y02 → Y03 → scores/[id] |
| F-S | 공유 | scores/[id] → S02 → S01 |
| F-L | 첫 방문 | L01 → record → scores/[id] |
| F-C | 찬양 콘티 | C01 → C02 → C03 → C04 |

## 팀장 결정 필요
- 후기·사용자 수는 실제 수치 확보 전까지 `미확인`(가짜 수치 금지).
- Y01 경로·로그인 필수 여부(가입 없이 시작 원칙과 충돌 가능).
- Pro 가격(07#5 제안 월 4,900~6,900원은 미확인 근거).
