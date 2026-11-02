# task-004 스파이크 2단계(기기 없이 가능한 측정) 보고

- 일시: 2026-11-02 · 환경: Windows 11, Node 26.13.0, npm 11.20.0, 시스템 Chrome 156(Playwright 1.64.1 `playwright-core`로 실행, 브라우저 다운로드 없음), 16코어, RTX 3060
- 격리: `spike/`(별도 package.json)에서만 설치·실행. 앱 `package.json`·lock·`src/` 미변경(번들 비교는 `npm install --no-save` + 임시 페이지, 측정 후 삭제). 병합 대상 아님. 오디오 파일 생성 없음(합성음은 메모리에서만).
- 1단계 스크립트(`bench.mjs` 등)는 worktree에 남아 있지 않아 이번에 새로 작성했다. 합성음 생성기가 1단계와 달라(`spike/lib.mjs`) **합성음 일치율은 1단계 보고와 직접 비교하지 말 것**(파이프라인 검증용).
- 설치: `@spotify/basic-pitch@1.0.1` · `@tensorflow/tfjs@3.21.0` · `@tensorflow/tfjs-backend-wasm@3.21.0` · `pitchy@4.1.0` · `@tonejs/midi@2.0.28` · `esbuild` · `playwright-core@1.64.1`. tfjs-core 3.21.0 단일(중복 없음), `npm audit` 0건. wasm 백엔드 라이선스는 `secscan license`로 별도 확인 필요(미실행).

## 1. wasm 백엔드 — Chromium 워커 처리 시간 (6장 #5·#6 일부)
입력: 합성 멜로디+반주, 22.05kHz. 같은 페이지에서 반복 실행. "추론"=`evaluateModel`, "후처리"=`outputToNotesPoly`+`noteFramesToTime`(순수 JS). 단위 초.

| 백엔드(구성) | 30초 첫 실행 | 30초 재실행(2회) | 3분(2회) | 3분 추론 / 후처리 | 음표 수(30초/3분) |
|---|---|---|---|---|---|
| wasm (SIMD, 스레드 없음) | 2.5 | 2.4 / 2.4 | 21.6 / 21.4 | 12.6 / 8.8 | 483 / 2910 |
| wasm (SIMD + 스레드, COOP/COEP로 crossOriginIsolated) | 2.1 | 1.8 / 1.8 | 18.4 / 18.3 | 9.8 / 8.5 | 483 / 2910 |
| webgl (headless Chrome, d3d11 인자) | 6.8 | 2.2 / 2.3 | 18.3 / 18.6 | 9.9 / 8.5 | 483 / 2910 |
| cpu (순수 JS) | 33.8 | 33.2 / 34.1 | 196.5 / 221.5 | 187 / 212 / 9 | 483 / 2910 |

- **네 백엔드의 음표 수가 같다**(483/2910) → wasm 결과가 webgl·cpu와 일치.
- wasm은 cpu 대비 약 10~14배 빠르고(3분 곡 약 21초 vs 약 197~221초), 이 PC에서는 webgl과 동급. webgl 첫 실행 6.8초는 셰이더 컴파일 비용, wasm은 첫 실행 패널티가 거의 없음(초기화 0.1초 미만 + wasm 로드).
- 3분 곡에서 후처리가 약 8.5초(전체의 40~46%). 모바일 CPU에서는 수 배 → 구간 단위 후처리 필요성은 1단계 결론 유지.
- **우회 필수 버그 2건**
  1. tfjs-backend-wasm 3.21의 `Fill` 커널이 `attrs.dtype`이 undefined면 모델 실행 중 `Unknown dtype undefined`로 죽는다(워커에서 재현, shim 유무와 무관). `tf.unregisterKernel("Fill","wasm")` 후 dtype 기본값(float32)을 넣은 `Fill` 커널로 다시 등록하면 정상(`spike/browser/worker.js` `patchWasmFill`). 앱 구현 시 이 커널 덮어쓰기가 필요하다. 라이브러리 버전을 올려 해결할지는 팀장 판단.
  2. `evaluateModel`의 `onComplete`는 **배치마다 여러 번 불린다**(30초 19회, 3분 110회). 마지막 호출 값만 쓰면 음표가 6개/0개로 줄어드는 조용한 오류가 난다 → 모든 호출 결과를 이어 붙이거나 배치 단위로 후처리해야 한다(4장 4번과 직결).
- wasm 스레드판은 `crossOriginIsolated`(COOP/COEP 헤더)에서만 쓰인다. 헤더 없으면 SIMD 단일 스레드판(≈20% 느림). **앱이 COEP를 켜면 외부 리소스(이미지·폰트·Supabase 등)에 영향** → 헤더 도입은 별도 결정 사항.
- 파일 크기(추가 다운로드): `tfjs-backend-wasm-simd.wasm` 378KB(gzip 120KB), `-threaded-simd.wasm` 387KB(gzip 125KB), SIMD 없는 `tfjs-backend-wasm.wasm` 276KB(gzip 104KB). JS는 기존 tfjs 번들에 wasm 백엔드 래퍼가 소폭 추가(워커 번들 전체 1,260KB, 1단계 1,112KB 대비 약 +150KB, minify·미압축). wasm 파일은 같은 출처에서 서빙해야 한다(`setWasmPaths`).
- 네트워크: 요청은 `/`, `/worker.js`, 모델 2파일, wasm 1파일뿐 → **모델·wasm 외 0건**. 스레드판의 `http://…/uuid` 요청은 blob 워커 생성이며 네트워크 아님.
- 한계: 데스크톱 16코어 값이다. 모바일(4~8코어, 스레드 제한) 수치가 아님. webgl 구성은 헤더리스 + d3d11 인자로 실행했고 렌더러 이름은 기록하지 않았다(SwiftShader일 가능성 배제 못 함 → webgl 열은 참고용). 측정 초반 실행은 잔여 프로세스와 겹쳐 2~10배 느리게 나와 버렸고, 위 표는 겹침 없이 다시 잰 값이다. 반복 2회 오차는 ±5% 안.

## 2. `next build` 전후 번들 비교 (6장 #4)
Next.js 16.4.3(Turbopack) 앱, `.next/static` 합계(`spike/build-size.mjs`). 전: 현재 앱 그대로. 후: `src/app/spike-bp/page.tsx`(클라이언트 컴포넌트, 버튼 클릭 시 `await import("@spotify/basic-pitch")` 1곳)만 임시 추가.

| 항목 | 전 | 후 | 증가 |
|---|---|---|---|
| 파일 수(js·css) | 47 | 50 | +3 |
| 합계 raw | 3,206,607 B | 4,258,057 B | **+1,051,450 B (+1.03MB)** |
| 합계 gzip | 917,432 B | 1,176,008 B | **+258,576 B (+253KB)** |
| 합계 brotli | 774,813 B | 978,392 B | +203,579 B (+199KB) |
| 새 청크 1개 | — | 1,024KB raw / 251KB gzip | basic-pitch + tfjs 전체 |
| 기존 최대 청크 | 1,339KB / 343KB gz | 1,339KB / 343KB gz | 변화 없음 |

- 증가분의 사실상 전부가 동적 import로 분리된 **한 개 청크(1,024KB, gzip 251KB)**. 기존 청크 크기는 그대로고, 서버 HTML·RSC·manifest에서 그 청크 이름이 참조되지 않음 → 처음 화면 로드 비용 증가 없음(그 기능을 쓸 때만 로드).
- 1단계 esbuild 추정(1,112KB / gzip 271KB)과 일치(−8%). 여기에 모델(`model.json` 170KB + 가중치 725KB, gzip 합 약 0.43MB)과 wasm(SIMD gzip 120KB)을 더하면 추가 다운로드는 **raw 약 2.1MB / gzip 약 0.8MB** → 8장 #2 "3MB 이내" 충족.
- 빌드 경고·오류 없음(Turbopack이 tfjs 의존을 그대로 번들). 단 이 비교는 클라이언트 청크 분리 확인이며, 워커로 분리하는 최종 구조의 번들은 별도.
- 모델 파일은 `public/`에 둘 때 `next build` 산출물에 포함되지 않아 위 수치에 없음.

## 3. 실녹음 벤치 스크립트 (6장 #1·#2)
`spike/audio-bench.mjs` — 파일을 넣고 한 번 돌리면 곡마다 A·B 결과 MIDI와 일치율 표가 나온다.

### 사용법
1. `spike/audio/`에 곡 파일을 넣는다(wav·mp3·m4a). **이 폴더는 .gitignore**(커밋 금지, 저장소에 오디오 두지 않음).
2. 정답이 있으면 같은 이름의 `.mid`를 같은 폴더에 둔다(`곡A.m4a` ↔ `곡A.mid`). 트랙 이름이 `melody`/`멜로디`/`vocal`/`보컬`/`lead`인 트랙이 있으면 그것만, 없으면 모든 트랙의 프레임별 최고음을 정답 멜로디로 쓴다. 정답 없으면 MIDI만 출력.
3. 실행(처음 한 번 `cd spike && npm install && node setup.mjs`):
   `node spike/audio-bench.mjs [--backend webgl|wasm|cpu] [--dir <폴더>]` (기본 webgl, 안 되면 `--backend wasm`)
4. 출력 `spike/out/audio/`: `<이름>.A.mid`(pitchy 멜로디) · `<이름>.B.mid`(basic-pitch 최고음 + 배음 억제 멜로디) · `<이름>.Ball.mid`(basic-pitch 전체 음) + 표준출력 마크다운 표 + `spike/out/results-audio.jsonl`. 귀로 확인(6장 #2)은 `.A.mid`·`.B.mid`를 정답과 같은 DAW에 겹쳐 듣는다.

### 동작
- 디코딩: 시스템 Chrome의 `OfflineAudioContext.decodeAudioData`(앱과 같은 경로, mp3·AAC 지원 확인). A는 44.1kHz, B는 22.05kHz로 각각 직접 디코딩(R6 경로 포함). 오디오는 파일로 쓰지 않고 메모리에서만 쓴다. ffmpeg 불필요.
- A: `offline-pitch.ts`와 같은 로직(창 2048·hop 10ms·RMS 게이트 0.0015·pitchy·clarity≥0.88) → 10ms 격자 MIDI. B: 워커에서 basic-pitch(onset 0.25·frame 0.25·최소 5프레임) → 프레임별 최고음; "단순 최고음"과 "배음 억제"(12·19·24·28·31·34·36반음 차이의 더 낮고 세기가 같거나 큰 음이 동시에 울리면 제외) 둘 다 채점.
- 지표(1단계와 동일): 정답이 울리는 10ms 프레임 중 반음 단위로 같은 MIDI를 낸 비율, 정답 음 경계 ±20ms 제외. 옥타브 오류 = 음이름은 같고 옥타브만 다른 비율.
- 파일 없이 파이프라인 검증: `node spike/audio-bench.mjs --selftest`(메모리 합성음). 디코딩·MIDI 읽기 경로 점검: `node spike/decode-check.mjs`(WAV 32kHz→44.1k/22.05k 디코딩 샘플 수 일치, 출력 .mid 재읽기 성공).

### 합성음 자가 검증 결과(실녹음 아님, 이번 합성기 기준)
| 입력 | A pitchy | B 단순 최고음 | B + 배음 억제 | A 옥타브 오류 |
|---|---|---|---|---|
| 30초 단선율 | 100.0% | 46.8% | 100.0% | 0.0% |
| 30초 멜로디 + 반주(이번 합성기는 반주가 큼) | 15.6% | 38.0% | 72.0% | 11.1% |
- 방향은 1단계와 같다(단순 최고음 실패, 배음 억제로 A 이상, 반주 곡에서 B가 A보다 높음). 실녹음 5~10곡 측정은 **곡 파일 대기**.

## 4. 다음 단계에 남은 것
| # | 항목 | 상태 |
|---|---|---|
| 6장 #1·#2 | 실녹음 A/B 일치율·사람 판정 | 곡을 `spike/audio/`에 넣고 위 명령 실행하면 됨 |
| 6장 #3·#6 | iOS Safari·Android Chrome 3분 처리 시간·크래시 | 실기기 필요 |
| 6장 #5 | WebKit 워커 백엔드 | WebKit 다운로드 금지로 미실행 |
| — | wasm 라이선스(`secscan license`)·COEP 도입 영향 | 팀장 확인 |
| — | Fill 커널 우회 vs 버전 변경, `onComplete` 배치 처리 | 설계 반영 필요 |

## 5. 재현
```
cd spike && npm install && node setup.mjs        # 모델·wasm 복사 + 워커 번들 (setup.mjs --dev: 비압축 디버그)
node wasm-bench.mjs wasm wasm-coi webgl cpu       # §1 (cpu 는 3분에 3~4분 걸림; 결과 out/results-wasm.jsonl)
# §2: 앱 루트에서
npm ci && npm run build && node spike/build-size.mjs . before
npm install --no-save @spotify/basic-pitch@1.0.1 @tensorflow/tfjs@3.21.0
#   src/app/spike-bp/page.tsx 임시 생성(버튼 onClick 에서 await import("@spotify/basic-pitch"))
npm run build && node spike/build-size.mjs . after   # 이후 임시 페이지 삭제
node spike/audio-bench.mjs --selftest             # §3
```
- 파일: `spike/{lib,setup,wasm-bench,audio-bench,decode-check,build-size,chunk-users}.mjs`, `spike/browser/{harness.mjs,worker.js,shim.js}`. Chrome 위치는 `CHROME_PATH`로 지정 가능.
- `.gitignore`에 `spike/audio/ spike/out/ spike/node_modules/ spike/model/ spike/browser/wasm/` 추가.
