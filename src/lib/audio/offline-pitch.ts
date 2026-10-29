import { analyzeWindow, createDetector, TRACK_HOP_SEC } from "./pitch-tracker";
import type { PitchFrame } from "../music/types";

/**
 * 오디오 파일 → 피치 프레임 (오프라인, 기기 안에서만).
 * 실시간 추적(pitch-tracker)과 같은 창 크기·RMS 게이트·pitchy 검출기를 쓰고, 프레임 간격도 같은 고정 hop(TRACK_HOP_SEC)으로 맞춘다.
 * 디코딩한 샘플은 메모리에서만 쓰고 저장·전송하지 않는다.
 */

const WINDOW = 2048;
/** 프레임 간격(초) — 실시간 추적(워클릿 고정 hop)과 같은 값 */
export const OFFLINE_HOP_SEC = TRACK_HOP_SEC;
/** 이만큼 프레임을 처리할 때마다 한 번 양보해 화면이 멈추지 않게 함 */
const YIELD_EVERY = 400;
/** 읽기 전 파일 크기 상한(바이트) — 큰 파일을 통째로 메모리에 올리지 않게 */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
/** 디코딩 후 길이 상한(초) */
export const MAX_AUDIO_SEC = 10 * 60;

/** 상한을 넘은 파일 (reason 으로 안내 문구 구분) */
export class AudioLimitError extends Error {
  constructor(readonly reason: "bytes" | "duration") {
    super(reason === "bytes" ? "audio file too large" : "audio too long");
    this.name = "AudioLimitError";
  }
}

/** 여러 채널을 평균해 모노로 */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  return out;
}

/** 모노 샘플 → 피치 프레임. time 0 = 파일 시작(창 중심 기준) */
export async function framesFromSamples(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<PitchFrame[]> {
  signal?.throwIfAborted();
  const detector = createDetector(WINDOW);
  const hop = Math.max(1, Math.round(sampleRate * OFFLINE_HOP_SEC));
  const frames: PitchFrame[] = [];
  const buf = new Float32Array(WINDOW);
  const last = samples.length - WINDOW;
  for (let start = 0, k = 0; start <= last; start += hop, k++) {
    buf.set(samples.subarray(start, start + WINDOW));
    frames.push({ time: (start + WINDOW / 2) / sampleRate, ...analyzeWindow(buf, sampleRate, detector) });
    if (k % YIELD_EVERY === YIELD_EVERY - 1) {
      onProgress?.(start / last);
      await new Promise((r) => setTimeout(r, 0));
      signal?.throwIfAborted(); // 취소되면 즉시 중단 — 샘플 참조는 호출 스택과 함께 풀림
    }
  }
  onProgress?.(1);
  return frames;
}

/** 파일 바이트 디코딩 (OfflineAudioContext — 재생 장치·사용자 제스처 불필요) */
export async function decodeAudioFile(file: Blob, signal?: AbortSignal): Promise<AudioBuffer> {
  if (file.size > MAX_AUDIO_BYTES) throw new AudioLimitError("bytes");
  const bytes = await file.arrayBuffer();
  signal?.throwIfAborted();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audio = await ctx.decodeAudioData(bytes);
  signal?.throwIfAborted();
  if (audio.duration > MAX_AUDIO_SEC) throw new AudioLimitError("duration");
  return audio;
}

export async function framesFromAudioFile(
  file: Blob,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<PitchFrame[]> {
  const audio = await decodeAudioFile(file, signal);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  return framesFromSamples(mixToMono(channels), audio.sampleRate, onProgress, signal);
}
