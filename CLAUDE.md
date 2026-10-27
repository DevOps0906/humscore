@AGENTS.md

# HumScore — 주 에이전트 지시 파일

> 팀 구성·모델·위임 규격은 전역 `~/.claude/nomad/TEAM.md`(NOMAD)를 따른다. 이 파일은 HumScore 고유 규칙만 적는다.
> 프로젝트 전용 팀원: `music-logic-coder`(src/lib/music/**). 나머지는 NOMAD 팀원(scout·builder·tester·reviewer·advisor 등).

## 병렬 작업 충돌 방지 규칙 (팀장 필독)

부에이전트 여러 명이 동시에 일해도 코드가 꼬이지 않도록 **① 파일 소유권 ② 격리 ③ 팀장 단독 통합** 세 겹으로 막는다.

### ① 파일 소유권 — 각 에이전트는 자기 영역에만 쓴다

| 에이전트 | 쓰기 영역 |
|---|---|
| `music-logic-coder` | `src/lib/music/**` (단, `types.ts`는 팀장 승인 시에만) |
| `builder` | `src/app/**`, `src/proxy.ts`, `src/components/**`, `src/hooks/**`, `src/lib/{audio,platform,storage}/**`, `public/**`, `ios/**`, `android/**`, `supabase/**` |
| `tester` | 테스트 파일만 (`**/__tests__/**`, `**/*.test.ts`, `e2e/**`) |
| `scout`, `reviewer`, `challenger`, `advisor` | 읽기 전용 |
| **팀장 전용** | `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `scripts/**`, `package.json`, lock 파일, 각종 config(`*.config.*`, `tsconfig.json`), git 작업 전부 |

- 구현 에이전트는 자기가 만든 함수의 테스트 파일은 추가해도 된다.
- 영역 밖 파일 수정이 필요하면 **고치지 말고 보고서에 `요청: <파일> — <이유>`로 남긴다.** 팀장이 순서를 정해 다시 배정한다.
- **공유 계약**(바꾸면 여러 영역이 깨지는 것): `src/lib/music/types.ts`의 `Score`, `src/lib/audio/context.ts`의 공개 함수. 변경은 팀장 결정 → 한 에이전트에만 배정 → 단독 실행.

### ② 병렬 실행 판단

```
쓰기 영역이 안 겹침   → 같은 작업 트리에서 동시 실행 OK
쓰기 영역이 겹침      → isolation: "worktree" 로 각자 격리 → 팀장이 순서대로 병합
공유 계약 변경 포함   → 병렬 금지, 단독 실행 후 나머지 진행
읽기 전용 에이전트    → 언제든 병렬 OK
```

### ③ 팀장 단독 통합 — 작업 1건의 흐름

1. **배정 전**: `git status`로 작업 트리가 깨끗한지 확인 (변경이 남아 있으면 먼저 커밋하거나 정리).
2. **배정**: 프롬프트에 작업 범위·쓰기 영역·완료 조건을 명시.
3. **완료 후 검증**: `npm run agents:check -- <에이전트명>` → 영역 밖 변경이 있으면 되돌리거나 재배정.
4. `npm test` · `npx tsc --noEmit` 통과 확인 → 필요 시 `reviewer`(code) 리뷰.
5. **커밋은 팀장만**, 작업 1건 = 커밋 1개. worktree 결과는 하나씩 병합하고 병합할 때마다 테스트.

### 모든 부에이전트 공통 금지

- `git commit` / `push` / `branch` / `checkout` / `reset` 등 git 상태 변경
- `npm install` 등 의존성 변경 (`package.json`은 팀장 전용)
- 다른 에이전트 영역 파일 수정, 포매터로 전체 파일 일괄 재작성

## 프로젝트 개요

흥얼거리면 악보가 되는 앱. **풀스택 Next.js 16 (Vercel) + Capacitor 8**(운영 도메인 원격 로드) 한 코드베이스로 웹·iOS·Android 동시 지원.

### 핵심 제약

1. 서버: Server Components · Server Actions(`src/app/actions/**`, zod 검증) · Supabase SSR 쿠키 인증(`src/proxy.ts`). 마이크·AudioContext 쓰는 화면은 클라이언트 컴포넌트 유지. `cacheComponents` 켜짐 → 사용자 데이터 읽기는 `<Suspense>` 안에서.
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
