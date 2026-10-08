# HumScore — 주 에이전트 지시 파일

## 에이전트 계층 구조 (PDF 가이드 기준)

| 직급 | 모델 | 역할 | 비용 |
|---|---|---|---|
| **팀장** (주 에이전트) | claude-opus-5-5 | 오케스트레이션, 아키텍처 결정 | $4/$20 |
| **외부 자문위원** | claude-fable-5-1 | 팀장이 막혔을 때만 (`architect`) | $10/$50 |
| **대리** | claude-sonnet-5-5 | 일상 구현 (`feature-implementer`, `music-logic-coder`, `tester`, `code-reviewer`) | $2/$10 |
| **막내** | claude-haiku-5-5 | 파일 찾기, 단순 탐색 (`file-finder`) | $0.10/$0.50 |

## 위임 규칙

```
파일·심볼 위치 찾기           → file-finder        (하이쿠, 막내)
UI·기능 구현                  → feature-implementer (소네트, 대리)
음악 알고리즘 구현             → music-logic-coder   (소네트, 대리)
테스트 작성·실행               → tester              (소네트, 대리)
코드 리뷰·품질 점검            → code-reviewer       (소네트, 대리)
아키텍처 결정·여러 에이전트 조율 → 주 에이전트(Opus) 직접 처리
오퍼스가 막혔을 때             → architect           (페이블, 자문)
```

## 비용 최적화 원칙

1. **먼저 하이쿠**: 파일 위치를 모를 때 `file-finder`로 경로 파악 → 찾은 후 소네트에 구현 위임
2. **소네트로 구현**: 대부분의 코딩 작업은 소네트(대리) 레벨
3. **오퍼스는 리뷰·판단**: 팀장은 결정과 검토에 집중
4. **페이블은 비상용**: 오퍼스가 2번 이상 시도 후 실패 시에만 호출

## 프로젝트 개요

흥얼거리면 악보가 되는 앱. **Next.js 16 (정적 export) + Capacitor 8** 한 코드베이스로 웹·iOS·Android 동시 지원.

### 핵심 제약

1. 정적 export → Server Actions / Route Handler / 쿠키 / PPR 사용 금지
2. 단일 데이터 모델 `Score` (`src/lib/music/types.ts`) — 모든 출력은 이 타입 기반
3. 전조는 `transpose` 값만 저장, 출력 시 적용 (원본 불변)
4. 마이크 음성 데이터 저장·전송 금지 (음표 숫자만 유지)
5. 라이선스 안전 스택만 추가 (MIT, BSD-3, Apache-2.0)

### 디렉터리 구조

```
src/
├── app/          # 화면 (클라이언트 컴포넌트)
├── components/   # 공유 컴포넌트
├── hooks/        # 커스텀 훅
└── lib/
    ├── music/    # 순수 TS 음악 코어 (브라우저 의존 없음)
    ├── audio/    # Web Audio (피치 추적, 피아노 합성, 메트로놈)
    ├── platform/ # 웹/앱 차이 흡수 (파일 저장·공유)
    └── storage/  # 로컬 저장 + Supabase 동기화
```

### 주요 명령어

```bash
npm run dev          # 개발 서버
npm test             # Vitest 단위 테스트
npm run build        # 정적 빌드
npm run cap:android  # Android Studio 열기
npm run cap:ios      # Xcode 열기 (macOS 필요)
```

### 오디오 핵심 패턴

**AudioContext 규칙**: `getAudioContext()`는 사용자 제스처 핸들러 안에서 동기적으로 호출.
`ctx.resume()`은 `void`로 fire-and-forget. `await` 절대 금지 (iOS/Safari 제스처 체인 끊김).

**소리 재생 패턴**:
```typescript
const ctx = getAudioContext();
if (ctx.state === "running") {
  playPianoNote(ctx, midi, ctx.currentTime + 0.015, opts);
} else {
  const h = () => {
    if (ctx.state === "running") { ctx.removeEventListener("statechange", h); playPianoNote(...); }
  };
  ctx.addEventListener("statechange", h);
}
```
