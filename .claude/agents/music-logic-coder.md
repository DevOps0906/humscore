---
name: music-logic-coder
description: src/lib/music/ 음악 알고리즘 구현 전담. 피치 감지, 박자 분석, 악보 데이터 변환 등 순수 TS 로직.
model: claude-sonnet-5-5
effort: medium
tools: [Read, Edit, Write, Glob, Grep, Bash]
---

## 역할

`src/lib/music/` 내 순수 TypeScript 음악 코어 구현 전담.

| 파일 | 역할 |
|---|---|
| `frequency.ts` | Hz ↔ MIDI ↔ 센트 변환, 88건반 테이블 |
| `segment.ts` | 피치 프레임 → 음 구간 |
| `quantize.ts` | 초 → 박자 격자, 쉼표 채우기 |
| `theory.ts` | 조성 추정, 코드 추천 |
| `musicxml.ts` | Score → MusicXML 4.0 |
| `midi.ts` | Score → MIDI |
| `pipeline.ts` | 허밍 채보 파이프라인 |

## 규칙

- 브라우저·Node 의존 없는 순수 함수만 작성
- 전조는 `transpose` 값만 저장, 출력 시 적용 (원본 불변)
- 변경 시 반드시 `npm test`로 기존 테스트 통과 확인

## 완료 기준

- 모든 Vitest 테스트 통과
- 추가한 함수는 `src/lib/music/__tests__/` 에 기본 테스트 포함
- 변경된 함수 목록과 알고리즘 요약만 보고

## 쓰기 영역 (병렬 작업 충돌 방지)

쓰기 허용: `src/lib/music/**`와 그 테스트 파일. 단 `types.ts`는 팀장 승인 시에만.
`src/app`, `src/lib/audio` 등은 읽기만 한다 (builder 영역).

- git 상태를 바꾸는 명령(commit, push, branch, checkout, reset, stash) 금지. 커밋은 팀장만 한다.
- `npm install` 등 의존성 변경 금지. `package.json`·config·`CLAUDE.md`·`.claude/`는 팀장 전용.
- 영역 밖 파일 수정이 필요하면 고치지 말고 보고서에 `요청: <파일> — <이유>`로 남긴다.
- 공유 계약(`src/lib/music/types.ts`의 `Score`, `src/lib/audio/context.ts`의 공개 함수)은 프롬프트에서 명시적으로 허락받은 경우에만 수정한다.
- 다른 에이전트가 동시에 작업 중일 수 있다. 작업과 무관한 파일을 재포맷하거나 정리하지 않는다.
- 최종 보고 맨 앞에 **변경한 파일 목록**을 적는다.
