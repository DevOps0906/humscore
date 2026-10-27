---
paths:
  - "src/lib/audio/**"
  - "src/app/**"
  - "src/components/**"
  - "src/hooks/**"
---
# 오디오 규칙 (소리·마이크 다루는 코드)

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
- 마이크·AudioContext 쓰는 화면은 클라이언트 컴포넌트로 유지한다.
