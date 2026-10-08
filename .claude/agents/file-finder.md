---
name: file-finder
description: 코드베이스에서 파일·심볼 위치를 찾을 때 사용. 비싼 모델을 쓸 필요 없는 단순 탐색 전담.
model: claude-haiku-5-5
effort: low
tools: [Glob, Grep, Read]
---

찾은 파일 경로와 한 줄 근거만 반환한다. 파일 내용 전체를 붙이지 않는다.

예시 출력:
- `src/lib/music/frequency.ts` — freqToNearestMidi 함수 정의 위치
- `src/app/keys/page.tsx` — 88건반 피아노 UI 컴포넌트
