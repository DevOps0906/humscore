# HumScore — 허밍으로 만드는 악보 (MVP)

흥얼거리면 악보가 되고, 원클릭으로 전조하고, 코드 악보·피아노 악보·MIDI·MusicXML·PDF로 내보내는 앱.
**풀스택 Next.js 16 (Vercel) + Supabase + Capacitor 8** — 웹은 https://humscore.vercel.app, 앱은 같은 주소를 원격 로드합니다.

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:3100  (마이크는 localhost 또는 https에서만 동작)
npm test             # Vitest 단위 테스트
npm run test:e2e     # Playwright E2E (로컬 프로덕션 빌드, desktop + mobile)
E2E_BASE_URL=https://humscore.vercel.app npm run test:e2e   # 운영 배포본 대상
```

환경변수(`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — 없으면 로컬 저장 모드로 동작.
`vercel env pull`로 받을 수 있습니다. Supabase Auth Redirect URLs에 `<도메인>/auth/callback`을 등록하세요.

### Docker로 실행

```bash
docker compose up -d           # 빌드 후 백그라운드 실행 → http://localhost:3200
docker compose up -d --build   # 코드 변경 후 다시 빌드
docker compose logs -f web     # 로그 보기
docker compose down            # 중지
```

- 접속 주소: **http://localhost:3200** (컨테이너 내부 3000 → 호스트 3200. 3100은 `npm run dev` 기본 포트와 겹치지 않게 비워 둠)
- Supabase 로그인·동기화를 켜려면 프로젝트 루트 `.env`에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 넣고 `--build`로 다시 빌드합니다(빌드 때 번들에 들어감). 비우면 이 기기 저장 모드로 동작합니다.
- 마이크는 localhost 또는 https에서만 동작하므로 같은 PC 브라우저에서 접속하세요.

### 앱으로 실행

```bash
npm run cap:android  # cap sync → Android Studio 열기
npm run cap:ios      # cap sync → Xcode 열기 (macOS 필요)
CAP_SERVER_URL=http://<PC IP>:3100 npx cap sync   # 실기기에서 개발 서버 라이브 리로드
```

앱은 `capacitor.config.ts`의 `server.url`(운영 도메인)을 불러오고, 연결 실패 시 `native-shell/index.html` 안내 페이지를 띄웁니다.
앱 웹뷰에서는 Google OAuth가 차단되므로 이메일 6자리 코드 로그인을 사용합니다.
플랫폼을 다시 만들었다면 `npx cap add android` 후 `npm run native:permissions`를 실행하세요.

## 구조

```
src/
├── app/
│   ├── (marketing)/          # / 랜딩 (서버 컴포넌트)
│   ├── (auth)/login/         # 이메일 코드 · Google 로그인
│   ├── auth/callback/        # Supabase OAuth 코드 교환 (Route Handler)
│   ├── (app)/                # 앱 화면 (탭바)
│   │   ├── library/          # 내 악보 목록
│   │   ├── record/           # 녹음: 메트로놈 + 실시간 음정(Hz·센트) + 궤적
│   │   ├── keys/             # 88건반 입력
│   │   └── scores/[id]/      # 악보 보기·편집·재생·전조·내보내기, perform/ 공연 모드
│   └── actions/              # Server Actions (악보 동기화, 로그아웃)
├── proxy.ts                  # Supabase 세션 쿠키 갱신
├── components/               # 공유 컴포넌트 (ui/ = shadcn)
├── hooks/
└── lib/
    ├── music/                # 순수 TypeScript 음악 코어 (UI·브라우저 의존 없음)
    ├── audio/                # Web Audio: 피치 추적(pitchy), 배음 합성 피아노, 메트로놈
    ├── platform/             # 웹/앱 차이 흡수 (파일 저장·공유 시트)
    └── storage/              # localStorage 기본 저장 + Supabase 동기화(병합·삭제 기록)
supabase/migrations/          # scores(RLS·소프트 삭제·LWW 트리거), transcription_jobs
e2e/                          # Playwright E2E
native-shell/                 # 앱 오프라인 안내 페이지
```

## 설계 원칙

1. **화면은 Next.js, 데이터는 Supabase(RLS), 무거운 오디오 연산은 나중에 Python 워커.**
   서버 코드는 Server Actions·Route Handler·proxy에만 두고, 마이크·AudioContext 화면은 클라이언트 컴포넌트로 유지합니다.
2. **하나의 악보 모델(`Score`), 여러 개의 뷰.** 모든 출력은 `Score` → MusicXML/MIDI 변환으로 만듭니다.
3. **전조는 데이터를 바꾸지 않음.** `transpose` 값만 저장하고 출력 시 적용 → 원키로 언제든 복귀.
4. **목소리는 저장하지 않음.** 마이크 음성은 기기 안에서 음표 숫자로만 변환됩니다.
5. **라이선스 안전 스택만 사용.** pitchy(MIT), OpenSheetMusicDisplay(BSD-3), @tonejs/midi(MIT), Capacitor(MIT), shadcn/ui·Radix(MIT). 폰트 Inter·Pretendard(OFL).

## MVP 범위

| 포함 | 다음 단계 |
|---|---|
| 허밍 → 단선율 악보, 메트로놈·카운트인 | 음원 파일 업로드 (Basic Pitch) |
| 조성 자동 추정, 마디별 코드 추천·수정 | 반 마디 단위 코드, 7th 화음 추천 |
| 원클릭 전조 ±12, 남성 음역 자동 옥타브 표기 | 기타 TAB, 이조악기 파트 |
| 코드 악보 / 피아노 대보표 | 오케스트라 편곡 (Python GPU 워커) |
| 배음 합성 피아노 재생 (음원 파일 0개) | 사운드폰트 실악기 음색 |
| MusicXML · MIDI(9개 악기) · PDF 내보내기 | 음성 명령 ("G키로 바꿔줘") |
| 공연 모드 (태블릿·페달) | 팀 공유, 결제·크레딧 |

## 진행 현황 (2026-11-02 기준)

웹 MVP(허밍 → 악보 → 편집·재생·내보내기·동기화)는 동작하고, 읽기 전용 공유 링크까지 main에 들어갔습니다. 앱 출시는 실기기 확인(task-005)이 남아 있습니다.

| 영역 | 현재 상태 |
|---|---|
| 허밍·건반 입력 → 악보 | 구현 · 빠른 패시지 인식 개선(task-008)은 실기기 수치 조정 대기 |
| 편집(셈여림·도돌이표·가사)·전조·내보내기(PDF·MIDI·MusicXML) | 구현 |
| 재생·연습(속도·구간 반복)·따라 치기 | 구현 · 판정 임계값은 실기기 실측 후 조정(task-016) |
| 클라우드 동기화(Supabase RLS·LWW) | 구현 · 통합 검증 완료(task-012) |
| 읽기 전용 공유 링크(`/s/[token]`) | 구현(task-019) · **운영 DB 미적용** — 저장소 Secrets 등록 후 DB migrate 실행 필요 |
| 음원 파일 → 음표(Basic Pitch) | 스파이크 2단계 완료 · 실녹음 판정 대기(task-015, 보류) |
| 앱(iOS·Android) | Capacitor 원격 로드 · 실기기 체크리스트 미수행 |

제한: 로그인은 체험용 자동 로그인(`NEXT_PUBLIC_AUTH_MOCK`)이 기본입니다. 운영 DB 마이그레이션 워크플로는 `SUPABASE_ACCESS_TOKEN`·`SUPABASE_DB_PASSWORD` Secrets가 없어 아직 한 번도 적용되지 않았습니다.

### 작업 진행률

근거: [`tasks/README.md`](tasks/README.md) 작업 20개의 상태(완료 개수 / 전체, 가중치 없음).

| 웨이브 | 완료 / 전체 | 남은 작업 |
|---|---|---|
| W0 준비 | 1 / 1 | — |
| W1 기본 기능·정리 | 7 / 8 | task-005 실기기 체크리스트(사용자) |
| W2 핵심 기능 | 6 / 8 | task-014 실기기 상수 조정, task-016 실기기 결과 반영 |
| W3 음원 변환 | 0 / 3 | task-004·015(실녹음 판정 대기), task-011(선행 대기) |
| **합계** | **14 / 20 (70%)** | |

### 구현된 주요 항목
- [x] 허밍·건반 입력, 조성·코드 추정, 원클릭 전조
- [x] 셈여림·헤어핀(겹침 방지)·도돌이표·가사(기기 안 음성 인식)
- [x] PDF(앱 포함)·MIDI·MusicXML 내보내기
- [x] 공연 모드 연습 재생(속도·구간 반복·현재 음 커서), 따라 치기
- [x] 클라우드 동기화와 RLS 통합 검증
- [x] 랜딩·내 악보 재디자인
- [x] 읽기 전용 공유 링크(토큰 해시 저장, 삭제 시 자동 회수)

### 다음 개발 단계
- [ ] 운영 DB 마이그레이션 적용(Secrets 등록 → DB migrate 수동 실행)
- [ ] 실기기 체크리스트(아래) → 판정·카운트인 상수 조정(task-016)
- [ ] 찬양 콘티(세트리스트) — 공유 링크 재사용
- [ ] 음원 파일 → 음표: 실녹음 5~10곡으로 판정(task-015)
- [ ] 내 악보 폴더·태그, 가격 안내·Pro 결제, 앱 스토어 출시

## 콘텐츠 바로가기

| 콘텐츠 | 화면 경로 | 기획·명세 문서 | 구현 코드 |
|---|---|---|---|
| 랜딩 | `/` | [03_SCREENS_UX](docs/03_SCREENS_UX.md) L01 | [`src/app/(marketing)/page.tsx`](<src/app/(marketing)/page.tsx>) |
| 녹음(허밍) | `/record` | [03_SCREENS_UX](docs/03_SCREENS_UX.md) R01 | [`src/app/(app)/record/`](<src/app/(app)/record/>) |
| 건반 입력 | `/keys` | [03_SCREENS_UX](docs/03_SCREENS_UX.md) K01 | [`src/app/(app)/keys/`](<src/app/(app)/keys/>) |
| 내 악보 | `/library` | [03_SCREENS_UX](docs/03_SCREENS_UX.md) B01 | [`src/app/(app)/library/`](<src/app/(app)/library/>) |
| 악보 상세·편집 | `/scores/[id]` | [03_SCREENS_UX](docs/03_SCREENS_UX.md) E01 | [`src/app/(app)/scores/[id]/`](<src/app/(app)/scores/[id]/>) |
| 공연 모드·연습 | `/scores/[id]/perform` | [task-002 명세](docs/specs/task-002-perform-boost.md) | [`src/app/(app)/scores/[id]/perform/`](<src/app/(app)/scores/[id]/perform/>) |
| 따라 치기 | `/scores/[id]/perform` | [task-010 명세](docs/specs/task-010-follow-along.md) | [`src/lib/music/follow.ts`](src/lib/music/follow.ts) |
| 공유 설정 | `/scores/[id]/share` | [task-019 명세](docs/specs/task-019-share-link.md) · [04_API](docs/04_API.md) | [`src/app/(app)/scores/[id]/share/`](<src/app/(app)/scores/[id]/share/>) |
| 공유 악보 보기 | `/s/[token]` | [task-019 명세](docs/specs/task-019-share-link.md) | [`src/app/s/[token]/`](<src/app/s/[token]/>) |
| 음원 → 음표(스파이크) | — | [task-004 명세](docs/specs/task-004-audio-transcription.md) · [2단계 보고](docs/specs/task-004-spike2-report.md) | 브랜치 `spike/task-004` |
| 기획 문서 | — | [PRD](docs/01_PRD.md) · [데이터 모델](docs/05_DATA_MODEL.md) · [벤치마크](docs/06_BENCHMARK.md) · [경쟁 분석](docs/07_COMPETITORS.md) · [ADR 0001](docs/adr/0001-youtube-tab-capture.md) | — |
| 작업 목록 | — | [tasks/README.md](tasks/README.md) · [tasks/NOW.md](tasks/NOW.md) | — |

## 실기기 테스트 체크리스트 (1주차 필수)

- [ ] iPhone: 첫 녹음 시 마이크 권한 팝업 → 허용 후 음정 표시
- [ ] iPhone: 무음 모드 스위치 켠 상태에서 재생 소리 확인
- [ ] Android: 권한 거부 후 재요청 동작
- [ ] 블루투스 이어폰 사용 시 박자 밀림 정도 (유선 대비)
- [ ] 저사양 안드로이드에서 16마디 악보 렌더 시간
- [ ] 공연 모드 + 블루투스 페이지 넘김 페달
