> 원본: task-004 스파이크 worktree(`spike/`)에서 복사. 원시 결과(results-*.jsonl)·스크립트는 worktree에만 있음. 본 저장소에는 의존성을 추가하지 않았다.

# task-004 스파이크(004-0) 보고 — Basic Pitch go/no-go 근거

- 일시: 2026-10-29 · 환경: Windows 11, Node 24.13.0, npm 11.18.0, Playwright 1.64.1(Chromium 156 · WebKit), GPU RTX 3060
- 격리: 이 worktree의 `spike/`(별도 package.json)에서만 설치·실행. 본 앱 `package.json`·`src/` 미변경, 병합 대상 아님.
- 근거 문서: `docs/specs/task-004-audio-transcription.md` 6장·8장. 보컬 정책은 8장 #3 (나) "보컬 음원은 기존 pitchy 경로로만"으로 가정.
- **정확도는 합성음만으로 측정 — 실녹음 측정 대기.** 합성음은 메모리에서만 생성, 파일 저장 없음.

## 1. 수치 표

### 1-1. 의존성 (6장 #4)
| 항목 | 값 |
|---|---|
| 패키지 | `@spotify/basic-pitch@1.0.1` (Apache-2.0, 마지막 릴리스 2022-08) |
| 추가 패키지 수 | **71개** (pitchy만 있는 상태 3 → 74) |
| tfjs | `@tensorflow/tfjs@3.21.0` 1벌 (core·converter·layers·data·backend-cpu·backend-webgl 모두 3.21.0, 중복 없음) |
| peer 충돌 | 없음 (`UNMET OPTIONAL encoding` 1건 — node-fetch 선택 의존, 무해) |
| `npm audit` | **0건** (info·low·moderate·high·critical 모두 0) |
| 라이선스 | MIT 57 · Apache-2.0 8 · Apache-2.0 AND MIT 1(tfjs-layers) · BSD-3-Clause 2 · **ISC 4**(cliui·get-caller-file·y18n·yargs-parser) · **BSD-2-Clause 1**(webidl-conversions) |
| 설치 스크립트 | core-js postinstall(광고 문구용) — npm allowScripts 미승인 상태로 실행 안 됨 |
- `secscan license`(spike·spike/browser lock 172개): **허용 172 · 검토 0 · 거부 0**. 단 secscan은 ISC·BSD-2를 허용으로 보지만 AGENTS.md#4 문구(MIT·BSD-3·Apache-2.0만)로는 밖 → **팀장 확인 필요**. 이 5개는 `@tensorflow/tfjs`의 CLI용 `yargs` 계열·`node-fetch`의 `whatwg-url` 계열 Node 전용 전이 의존이고, esbuild 브라우저 번들 입력 목록에 없음(번들 0KB).
- 집계는 `npm query "*"`의 license 필드.

### 1-2. 모델·번들 크기 (6장 #4, 8장 #2 "추가 다운로드 3MB 이내")
| 항목 | raw | gzip |
|---|---|---|
| 모델 `model/model.json` (패키지 안 포함) | 170KB | 8.5KB |
| 모델 `model/group1-shard1of1.bin` (패키지 안 포함) | 725KB | 417KB |
| JS 청크(basic-pitch + tfjs 3 전체, esbuild minify, 동적 import 1청크 가정) | 1,112KB | 271KB (brotli 216KB) |
| **합계 추가 다운로드** | **약 2.0MB** | **약 0.7MB** |
- JS 내역: tfjs-backend-webgl 315KB · core 240KB · layers 190KB · backend-cpu 114KB · converter 114KB · @tonejs/midi 21KB · tfjs-data 14KB. `import * as tf`라 트리셰이킹이 거의 안 됨(실사용 import만 해도 동일 1,112KB). tfjs-core+converter+webgl만 쓰면 layers·data·midi 약 235KB 절감 가능(8장 #5 대안과 연결).
- `next build` 전후 비교는 **미측정**(worktree에 앱 의존성 미설치, 앱 코드 변경 금지) → esbuild 추정치.

### 1-3. 처리 시간·메모리 (6장 #6 일부)
| 실행 | 길이 | 백엔드 | 처리 시간 | 최대 메모리 |
|---|---|---|---|---|
| A pitchy (Node) | 30초 / 3분 | JS | 0.8~1.1초 / 4.5초 | (측정 안 함, B보다 작음) |
| B Node tfjs 순수 JS | 30초 단선율 | cpu | 88.7초 | RSS 207MB (기준 102MB) |
| B Node tfjs 순수 JS | 30초 반주 | cpu | 91.0초 | RSS 207MB |
| B Node tfjs 순수 JS | **3분 반주** | cpu | **523.9초(8분 44초)** | **RSS 446MB**, heap 236MB, external 266MB |
| B Chromium 워커, 실제 GPU(D3D11) | 30초 반주 | webgl | 15.1초(추론 13.9초) | 미측정 |
| B Chromium 워커, 실제 GPU(D3D11) | **3분 반주** | webgl | **41.0초**(추론 13.9초 + 후처리 27.1초) | 미측정 |
| B Chromium 워커, SwiftShader(소프트웨어 GL) | 30초 반주 | webgl | 23.4초 | 미측정 |
| B Chromium 워커 | 30초 반주 | cpu | 93.0초 | 미측정 |
- **3분 곡에서는 후처리(`outputToNotesPoly`, 순수 JS)가 전체의 2/3** — 길이에 비례 이상으로 늘어남(30초 1.2초 → 3분 27초). GPU가 있어도 모바일 CPU에서는 후처리만으로 8장 #2(60초)를 넘을 위험 → 구간 단위 후처리(4장 4번)가 시간 측면에서도 필요.
- 30초 webgl 추론 13.9초 중 상당 부분은 첫 실행 셰이더 컴파일로 추정(3분 추론도 13.9초).
- Node 30초 측정 일부는 브라우저 디버그 실행과 겹쳐 CPU 경합이 있었음(±10% 정도 오차 가능).
- 음표 수가 Node cpu와 Chromium webgl에서 같음(30초 반주 448개) → 백엔드 간 결과 일치.
- 메모리는 추론 결과(frames·onsets 프레임 행렬)를 전부 모은 뒤 후처리하는 basic-pitch 기본 사용 방식 기준. 3분에서 RSS +290MB → 4장 4번 "배치 단위 후처리"가 iOS에서 사실상 필수.

### 1-4. 음 일치율 — 합성음 (6장 #1·#2 대리 지표, 실녹음 측정 대기)
지표: 10ms 프레임 단위, 정답 멜로디가 울리는 프레임 중 반음 단위로 같은 MIDI를 낸 비율(음 경계 ±20ms 제외).
A = `offline-pitch.ts`와 같은 로직(창 2048·hop 10ms·RMS 게이트·clarity≥0.88). B = basic-pitch(onset 0.25·frame 0.25·최소 5프레임) → 프레임별 최고음.

| 입력 | A pitchy | B 최고음(단순) | B 최고음 + 배음 억제 | A 옥타브 오류 |
|---|---|---|---|---|
| 30초 단선율(배음 5개 악기음) | **100%** | 36.8% | **98.5%** | 0% |
| 30초 멜로디 + 3화음 반주·베이스 | 46.2% | 38.5% | **64.2%** | 16.8% |
| 3분 멜로디 + 반주 | 45.0% | 24.6% | **75.8%** | 17.0% |
- **최고음 단순 축약은 실패**: basic-pitch가 악기 배음(예: 74 위 +28반음=102)을 별도 음으로 잡아 최고음이 배음으로 감. 단선율에서도 37%.
- "배음 억제"(동시에 울리는 더 낮고 세기가 같거나 큰 음과 12·19·24·28·31·34·36반음 차이면 제외) 1단계를 넣으면 단선율 98.5%, 반주 곡에서 A보다 +18~31%p. 이 규칙은 스파이크용 즉석 규칙이며 실녹음에서 검증 필요(R5).
- 반주 곡의 오검출(쉼표 구간에 음 출력)은 반주가 계속 울려 A·B 모두 높게 나와 의미 없음 → 표에서 제외.

### 1-5. 브라우저 워커 백엔드 (6장 #5) · 네트워크 (6장 #7)
| 브라우저(Playwright) | OffscreenCanvas | `tf.getBackend()` | 렌더러 | 결과 |
|---|---|---|---|---|
| Chromium 156 (GPU 인자) | 있음 | **webgl (WebGL2)** | ANGLE D3D11, RTX 3060 | shim 있으면 정상 |
| Chromium 156 headless | 있음 | **webgl (WebGL2)** | SwiftShader(소프트웨어) | shim 있으면 정상 |
| Chromium, shim 없음 | 있음 | webgl 설정 성공 | — | **멈춤**: `ReferenceError: window is not defined` (`PlatformBrowser.setTimeoutCustom`) 이 워커 비동기 콜백에서 나 결과가 영영 안 옴. `USE_SETTIMEOUTCUSTOM=false` 플래그로는 해결 안 됨(`!window` 검사에서 먼저 터짐) |
| WebKit | — | — | — | **미확인**: Playwright 1.64.1이 요구하는 webkit-2370 미설치(캐시엔 2287만). 사용자 공용 캐시에 내려받는 일이라 안 함 |
- 네트워크(6장 #7): 모든 실행에서 요청은 `/`, `/worker.js`, `/model/model.json`, `/model/group1-shard1of1.bin` 4건뿐 → **모델 파일 외 0건**(같은 출처). 단 실제 앱은 파일 디코딩 경로까지 포함해 다시 확인 필요.

## 2. go/no-go 권고
**조건부 go (스파이크 2단계로 진행) — 지금 바로 본 구현(부록 A) 착수는 아님.**

근거
1. 의존성: audit 0건, tfjs 3.21 단일 트리, 추가 다운로드 gzip 약 0.7MB(8장 #2 3MB 이내). 8장 #5는 "tfjs 3 고정 수용"으로 충분해 보임. 단 ISC·BSD-2 전이 의존 5개는 규칙 밖 → 팀장 판정 필요.
2. 정확도: 합성 반주 곡에서 B(배음 억제)가 A보다 높음, 단선율은 동급 — 6장 #1 방향과 일치. 단 **단순 최고음 축약으로는 6장 #2 미달**이 확정이므로, 배음 억제 후처리가 설계에 들어가야 함.
3. 성능: 데스크톱 GPU webgl 3분 41초(8장 #2 60초 안), 단 후처리 27초가 순수 JS라 모바일 CPU에선 수 배 늘 가능성 → 모바일 실측 전까지 미정. CPU 강등 시(순수 JS) 3분 8분 44초로 8장 #2(60초) 크게 초과 → **webgl 실패 기기는 B를 쓰지 말고 A로** 처리하는 규칙 필요(또는 wasm 백엔드 추가 검토).
4. 워커 webgl은 tfjs 3.21 버그(`PlatformBrowser.setTimeoutCustom`이 `window` 참조) 때문에 **우회 없이는 멈춤**(예외도 안 던지고 결과가 오지 않음). `self.window = self` 1줄 shim으로 해결. 이 shim과 타임아웃 감시가 구현 필수 항목.

no-go로 바꿀 조건: 실녹음 곡 세트에서 B(배음 억제)가 A 이하이거나, iOS Safari 3분 처리 시간·메모리가 8장 #2를 넘을 때.

## 3. 확인 못 한 항목
| # | 항목 | 사유 |
|---|---|---|
| 6장 #1·#2 | 실녹음 5~10곡 A/B 일치율, 축약 결과 사람 판정 | 곡 세트 없음 — 합성음만 측정 |
| 6장 #3 | iOS Safari 최대 처리 길이·크래시 | 실기기 없음. 데스크톱 WebKit도 브라우저 미설치로 못 돌림 |
| 6장 #5 | WebKit/Safari 워커 webgl | 위와 같음 |
| 6장 #6 | Android Chrome·iOS Safari 3분 처리 시간 | 실기기 없음 |
| 6장 #4 | `next build` 전후 번들 비교 | worktree 앱 의존성 미설치·앱 코드 변경 금지 → esbuild 추정 |
| 6장 #5 | wasm 백엔드(`@tensorflow/tfjs-backend-wasm@3.21`) | 미설치·미측정 (CPU 강등 대안 후보) |
| R6 | 22.05kHz `OfflineAudioContext` 직접 디코딩 품질 | 합성음을 22.05kHz로 직접 생성해 디코딩 경로 미검증 |
| 보컬 | 보컬 음원에서 B 동작 | (나) 정책 가정으로 범위 밖 |
| 기타 | 브라우저 최대 메모리 | 워커 메모리 API 없음, 미측정 |

## 4. 재현
- `spike/bench.mjs <mono|mix> <초>` (Node, A/B 정확도·시간·메모리) → `spike/results-cpu.jsonl`
- `spike/browser/run.mjs <chromium|webkit> <headless|gpu> <webgl|cpu> <초> <mono|mix> <none|shim>` → `spike/results-browser.jsonl`
- `spike/browser/size.mjs` (번들 크기), 합성 방식 `spike/synth.mjs`
- 모델 파일은 `npm pack @spotify/basic-pitch@1.0.1`에서 꺼내 `spike/model/`에 복사(패키지 안 `model/` 그대로).
