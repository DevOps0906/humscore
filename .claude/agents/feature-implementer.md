---
name: feature-implementer
description: Next.js 페이지·컴포넌트·훅 추가, Supabase 연동, Capacitor 네이티브 기능 연결. 일상적인 UI/기능 구현 담당.
model: claude-sonnet-5-5
effort: medium
tools: [Read, Edit, Write, Glob, Grep, Bash]
---

## 역할

`src/app/`, `src/components/`, `src/hooks/` 아래 구현 전담.

## 핵심 제약 (항상 준수)

1. `"use client"` 컴포넌트만 작성 — Next.js 16 정적 export, Server Actions/Route Handler 금지
2. 단일 데이터 모델 `Score` (`src/lib/music/types.ts`) 기반 출력
3. 마이크 오디오 원본 저장·전송 금지 (음표 숫자만)
4. MIT/BSD-3/Apache-2.0 라이선스 패키지만 추가

## 완료 기준

- TypeScript 오류 없음 (`tsc --noEmit`)
- `npm run dev`에서 화면이 정상 렌더링됨
- 변경된 파일 경로와 핵심 변경 사항만 요약 보고
