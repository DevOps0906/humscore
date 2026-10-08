/**
 * 앱 전체가 공유하는 AudioContext 하나.
 * iOS(WKWebView)·사파리는 사용자 터치 이벤트 안에서 resume() 해야 소리가 납니다.
 * → 버튼 onClick 핸들러에서 반드시 getAudioContext() 를 먼저 호출하세요.
 *
 * resume()을 await하지 않는 이유: await하는 순간 사용자 제스처 컨텍스트가 끊겨
 * iOS·Safari에서 resume()이 거부됩니다. fire-and-forget으로 호출해야 합니다.
 */
let ctx: AudioContext | null = null;

type AudioSessionType = "playback" | "play-and-record";

/** iOS 16.4+ Audio Session API 최소 타입 */
interface NavigatorWithAudioSession {
  audioSession?: { type: string };
}

/**
 * 오디오 세션 종류 설정 (무음 스위치에서도 재생되게 "playback", 녹음 중엔 "play-and-record").
 * 동기 호출이며 미지원 환경에서는 아무 일도 하지 않습니다.
 */
export function setAudioSessionType(type: AudioSessionType): void {
  if (typeof navigator === "undefined") return;
  try {
    const session = (navigator as unknown as NavigatorWithAudioSession).audioSession;
    if (session && session.type !== type) session.type = type;
  } catch {
    /* 미지원/거부는 무시 */
  }
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    setAudioSessionType("playback");
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: "interactive" });
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
