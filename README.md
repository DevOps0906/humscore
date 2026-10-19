# HumScore — 허밍으로 만드는 악보 (MVP)

흥얼거리면 악보가 되고, 원클릭으로 전조하고, 코드 악보·피아노 악보·MIDI·MusicXML·PDF로 내보내는 앱.
**Next.js(정적 export) + Capacitor 8** 한 코드베이스로 웹 · iOS · 안드로이드를 동시에 만듭니다.

## 빠른 시작

```bash
npm install
npm run dev          # http://localhost:3100  (마이크는 localhost 또는 https에서만 동작)
npm test             # 음악 코어 로직 단위 테스트
```

### 앱으로 실행

```bash
npm run cap:android  # next build → cap sync → Android Studio 열기
npm run cap:ios      # next build → cap sync → Xcode 열기 (macOS 필요)
```

`android/`, `ios/` 프로젝트는 이미 생성되어 있고 마이크 권한도 들어가 있습니다.
플랫폼을 지우고 다시 만들었다면 `npx cap add android` 후 `npm run native:permissions` 를 꼭 실행하세요.

실기기에서 라이브 리로드로 개발하려면 `capacitor.config.ts` 의 `server.url` 주석을 풀고 PC IP를 넣으세요.
**배포 빌드에서는 반드시 다시 주석 처리** (원격 URL만 띄우는 앱은 애플 심사 거절 위험).

## 구조

```
src/
├── app/                      # 화면 (모두 클라이언트 컴포넌트, 정적 export)
│   ├── record/               # ① 녹음: 메트로놈 + 실시간 음정(Hz·센트) + 궤적
│   ├── page.tsx              # ② 내 악보 목록
│   ├── score/                # ③ 악보: 코드 악보/피아노 전환, 코드 수정, 재생, 전조, 내보내기
│   ├── perform/              # ④ 공연 모드: 태블릿 보면대, 탭/블루투스 페달 넘김, 즉석 전조
│   └── keys/                 # 88건반 주파수 탐색기
├── lib/
│   ├── music/                # 순수 TypeScript (UI·브라우저 의존 없음 → 테스트·서버 재사용 가능)
│   │   ├── frequency.ts      # 88건반 테이블, Hz ↔ MIDI ↔ 센트
│   │   ├── segment.ts        # 피치 프레임 → 음 구간 (중앙값 필터, 반복음 분리)
│   │   ├── quantize.ts       # 초 → 박자 격자, 쉼표 채우기
│   │   ├── theory.ts         # 조성 추정, 코드 추천(규칙 기반), 전조
│   │   ├── musicxml.ts       # Score → MusicXML 4.0 (리드시트/피아노 대보표, 붙임줄)
│   │   ├── midi.ts           # Score → MIDI (멜로디 악기 선택 + 코드 트랙)
│   │   └── pipeline.ts       # 위 단계를 묶은 허밍 채보 파이프라인
│   ├── audio/                # Web Audio: 피치 추적(pitchy), 배음 합성 피아노, 메트로놈
│   ├── platform/             # 웹/앱 차이 흡수 (파일 저장·공유 시트)
│   └── storage/              # 로컬 저장 + Supabase 동기화(선택)
supabase/migrations/          # scores 테이블 + RLS, 3단계용 transcription_jobs 큐
scripts/native-permissions.mjs
```

## 설계 원칙

1. **화면은 Next.js, 데이터는 Supabase, 무거운 오디오 연산은 나중에 Python 워커.**
   앱 번들에는 서버가 없으므로 Server Actions·동적 Route Handler·Proxy·쿠키·Cache Components(PPR)는 쓰지 않습니다.
2. **하나의 악보 모델(`Score`), 여러 개의 뷰.** 모든 출력은 `Score` → MusicXML/MIDI 변환으로 만듭니다.
3. **전조는 데이터를 바꾸지 않음.** `transpose` 값만 저장하고 출력 시 적용 → 원키로 언제든 복귀.
4. **목소리는 저장하지 않음.** 마이크 음성은 기기 안에서 음표 숫자로만 변환됩니다.
5. **라이선스 안전 스택만 사용.** pitchy(MIT), OpenSheetMusicDisplay(BSD-3), @tonejs/midi(MIT), Capacitor(MIT).

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

## 실기기 테스트 체크리스트 (1주차 필수)

- [ ] iPhone: 첫 녹음 시 마이크 권한 팝업 → 허용 후 음정 표시
- [ ] iPhone: 무음 모드 스위치 켠 상태에서 재생 소리 확인
- [ ] Android: 권한 거부 후 재요청 동작
- [ ] 블루투스 이어폰 사용 시 박자 밀림 정도 (유선 대비)
- [ ] 저사양 안드로이드에서 16마디 악보 렌더 시간
- [ ] 공연 모드 + 블루투스 페이지 넘김 페달
