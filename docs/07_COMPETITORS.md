# 07. 경쟁 서비스 비교 (허밍·음원 → 악보)

> 출처: 사용자 제공 조사(2026-10-28). 랜딩 화면은 대부분 직접 보지 못했고 App Store·공식 블로그·기사 텍스트 기준. HumScore는 레포 코드 기준.
> Songscription 비교 글은 자사 글이라 편향 가능. 가격·평점은 조회 시점 기준. 피아노 교육 앱 비교는 [06_BENCHMARK.md](06_BENCHMARK.md).

## 1. 시장에서의 위치
- **음원 전사형**(Klangio, Songscription, AnthemScore): 파일·유튜브 링크 → 악보. 허밍은 부가 기능.
- **허밍형**(Melody Scanner, Humming Note, AnySing, ScoreCloud): 직접 부르는 방식. 허밍 정확도 불만이 크고 평점이 낮다.
- HumScore는 허밍형. 허밍형의 약점(정확도·편집·한국어·개인정보)을 노릴 수 있다.

## 2. 경쟁사 10곳

| # | 서비스 | 핵심 | 가격·평점 | 장점 | 단점 |
|---|---|---|---|---|---|
| 1 | Klangio (Sing2Notes, Transcription Studio) | 보컬·다중 악기 → 악보·탭·MIDI | Sing2Notes Pro $9.99/월, 티켓 $1.99~. 3.6점(79건) | DAW 플러그인, 전조·편집, 응대 좋음 | 음 누락·오인식, 앱이 악기별로 분리, 요금 복잡 |
| 2 | Songscription | 파일·유튜브·마이크 → 악보, 에디터, 피아노롤 | 무료 30초, 유료 플랜 | 업로드 중심 랜딩, 후기 슬라이드, 4종 내보내기, 500만 달러 투자·15만 유저 | 네이티브 앱 없음, 합창 파트 분리 안 됨 |
| 3 | Melody Scanner | 마이크·유튜브·파일 → 악보 | $5.99/월, 무료 40마디. 1.7점(35건) | 클래식·피아노롤·탭 3종 뷰 | 허밍 정확도 혹평, 로그인 강제, 솔로만 |
| 4 | ScoreCloud | 허밍 → 악보, Auto Chords, 오버더빙 | 미확인 | 전체 편집, 반주·코드 | 데스크톱 중심, 박자 보정 필요 |
| 5 | AnthemScore | 데스크톱 전사, 스펙트로그램 편집 | 일회성 구매, 체험 곡당 30초 | 오프라인, 정밀 수정 | 설치형, 모바일 없음 |
| 6 | Flat | 악보 에디터, 실시간 협업 | $9.99/월, 4.6점(약 7천 건) | 90종 악기, 댓글·협업, PDF 가져오기 | 재생 음질, 구독 부담 |
| 7 | Soundslice | 연습 도구(싱크 플레이어) | 에디터 기본 무료 | 구간 루프, 음높이 유지 속도조절, 파트 음소거 | 채보 기능 아님 |
| 8 | Hum On! (삼성 C-Lab → 쿨잼컴퍼니) | 허밍 → 악보 + 자동 반주 5장르 | 미확인 | 반주 생성 | 2016년 자료, 운영 여부 미확인 |
| 9 | AnySing | 허밍·휘파람 → 피아노롤, 멀티트랙 | 무료, 4.0점(13건) | 실시간 변환, 음계 보정 | 내보내기 WAV·MIDI뿐(확인 범위) |
| 10 | Humming Note | 허밍 → MIDI | 무료, 1.8점(8건) | 단순함 | 오인식, 내보내기 찾기 어려움 |

## 3. HumScore 비교

**앞선 점 (코드 확인)**: 기기 안 처리(음표 숫자만) · 가입 없이 시작 · 메트로놈·카운트인·실시간 음정(Hz·센트)·라이브 음가 미리보기 · 코드 추천·원클릭 전조(원본 불변)·88건반·MIDI 입력 · 공연 모드(페이지 터너 페달) · 한국어 UX · 웹·앱 단일 코드베이스.

**부족한 점**

| 영역 | 부족한 점 | 참고 |
|---|---|---|
| 랜딩 | 결과물 데모 없음(에디터가 SVG 목업) | Songscription |
| 랜딩 | 히어로 CTA 3개로 분산 | Songscription(업로드 하나) |
| 랜딩 | 후기·사용자 수 등 사회적 증거 없음 | Songscription |
| 랜딩 | 가격 안내 없음 | Melody Scanner, Klangio |
| 입력 | 음원 파일·유튜브 링크 불가 (task-004 대기) | Songscription, Klangio |
| 플랫폼 | iOS·Android 앱 미출시 | Melody Scanner, Flat |
| 연습 | 구간 루프·속도 조절·파트 음소거 미확인 | Soundslice |
| 대시보드 | 최근순 정렬만. 검색·폴더·태그·공유 링크 없음 | Flat |
| 편곡 | 자동 반주·장르 스타일 없음 | Hum On!, ScoreCloud |
| 음악 | 단선율만, 기타 TAB 없음 | Klangio, Melody Scanner |

디자인: 다크 라벤더 톤은 경쟁사와 구분되는 브랜드 자산. 약점은 톤이 아니라 **실제 결과물을 보여주지 않는 것**.

## 4. 전략 요지
1. 허밍 정확도가 시장 공백(허밍 앱 평점 1.7·1.8·3.6). 정확도 개선과 공개 데모가 곧 마케팅 소재.
2. 허밍은 기기 안 처리 → 서버 원가 0. 허밍은 무료 유지 가능.
3. 포지셔닝: "한국어 · 가입 없이 · 목소리는 기기 밖으로 나가지 않는 허밍 악보 + 연습·공연". 음원 전사 정면 승부는 피한다.

## 5. 수익화·확장 메모
- 가격 앵커: Melody Scanner $5.99/월, Klangio £4~, Sing2Notes $9.99/월, Flat $9.99/월. 제안: 허밍 무료, Pro 월 4,900~6,900원.
- 범위 밖 기회: 교회 찬양팀·성가대·합창단, "허밍 → 악보" 숏츠 콘텐츠.

## 6. 출처
- https://www.songscription.ai/blog/melody-scanner-alternatives
- https://www.songscription.ai/blog/anthemscore-alternatives
- https://www.songscription.ai/for-ensembles
- https://www.musicbusinessworldwide.com/songscription-raises-5m-in-funding-as-shazam-for-sheet-music-platform-reaches-150k-users/
- https://www.soundonsound.com/news/klangio-launch-transcription-studio
- https://apps.apple.com/us/app/-/id1588721118
- https://apps.apple.com/us/app/-/id6472921068
- https://scorecloud.com/learn/humming-to-sheet-music/
- https://soundslice.com/features/
- https://apps.apple.com/us/app/flat-sheet-music-maker-tabs/id1177592149
- https://apps.apple.com/us/app/-/id6747541661
- https://apps.apple.com/us/app/-/id1575316445
- https://www.venturesquare.net/739975/
- https://limelight-arts.com.au/news/samsung-launches-app-that-turns-singing-into-sheet-music/

## 7. 조사에서 빠진 것 (보완)

> 경쟁사 칸은 1~5장·06장에서 확인된 것만 쓰고, 나머지는 `미확인`(조사 필요). HumScore 칸은 레포를 새로 읽지 않았으므로 07#3·06#2 기준이며 모르면 "코드 미확인". 기능 우선순위는 [01_PRD.md#3](01_PRD.md).

| 관점 | 경쟁사 상황 | HumScore 현황 | 대응 기능 |
|---|---|---|---|
| 접근성 | 미확인 (스크린리더·색 대비·큰 글씨 지원 조사 필요) | 코드 미확인 (악보 SVG의 대체 텍스트·키보드 조작·색 대비 점검 필요) | 접근성 점검 작업 신설(P1 후보). 건반·악보 키보드 조작, 대비 토큰 검사 |
| 온보딩·마이크 보정 | 허밍 앱 평점 1.7·1.8·3.6 → 인식 불만 큼(2장). 안내 방식은 미확인 | 가입 없이 시작·메트로놈·카운트인·실시간 음정은 있음(3장). 소음·거리 점검과 첫 사용 안내는 코드 미확인 | 녹음 전 환경 점검·템포 가이드(06#4), 첫 악보 완성률 개선(01#5). 88건반을 안전 경로로 안내(06#3.1) |
| 내보내기 형식 | Songscription 4종, Klangio 악보·탭·MIDI, AnySing WAV·MIDI, Melody Scanner 3종 뷰(2장) | PDF는 있음(앱 PDF는 task-001 대기). MusicXML·MIDI 내보내기는 코드 미확인 | MusicXML·MIDI·PDF를 Pro 내보내기로 묶음(01#4). 앱 PDF = task-001 |
| 오프라인 | AnthemScore는 오프라인 동작(2장). 나머지는 미확인 | 허밍은 기기 안 처리(3장). 완전 오프라인(PWA 캐시)·앱의 원격 로드 한계는 코드 미확인 | 오프라인 동작 범위 조사 후 결정. 앱은 운영 도메인 원격 로드라 오프라인 제약 가능(추정) |
| 저작권·공유 정책 | Songscription 합창 파트 분리 안 됨(2장). 업로드·공유 곡의 저작권 정책은 미확인 | 공유 링크 없음(3장). 약관·신고 절차 없음(코드 미확인) | 읽기 전용 공유 링크(P1)에 약관·신고·noindex 포함(01#8). 공유 곡 라이브러리·유튜브 변환은 권리 확인 후(01#6·#7) |
| 측정(분석) 체계 | 해당 없음(경쟁사 내부 지표 미확인) | 이벤트 수집·대시보드 코드 미확인 | 방문→녹음→변환→저장 이벤트, D7. 음성·악보 내용은 수집 금지(01#5·#6). 도구 선택은 팀장 결정 필요 |
| 국내 경쟁 | 피아노스쿨: 전자악보 약 1,200곡, 이용권 1개월 19,000~40,000원·1년 239,000원, 마이크는 스토어 설명에 없음(06#2). Hum On!(운영 미확인)·Google Play 등록 여부 미확인 | 한국어 UX는 강점(3장). 국내 허밍→악보 서비스 추가 조사는 미실시 | 학습 앱과 경쟁하지 않고 창작·보관·공연 중심(06#5). 국내 사용자 가격 수용도는 검증 필요(01#4) |
