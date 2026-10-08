import { PitchDetector } from "pitchy";
import { getAudioContext } from "./context";
import { playClick } from "./piano-synth";
import type { PitchFrame } from "../music/types";

/**
 * 마이크 → 실시간 피치 프레임.
 * 녹음 원본(오디오)은 어디에도 저장하지 않고, 음정 숫자만 남깁니다. (개인정보 최소화)
 */

export interface TrackerOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 녹음 전 카운트인 마디 수 */
  countInMeasures: number;
  /** 녹음 중 메트로놈 클릭 */
  metronome: boolean;
  onFrame?: (frame: PitchFrame) => void;
  /** 현재 박(카운트인 중에는 음수) */
  onBeat?: (beat: number) => void;
}

export interface TrackerSession {
  /** 녹음 종료 후 프레임 반환 (time 0 = 카운트인 직후 첫 박) */
  stop: () => PitchFrame[];
}

const FFT_SIZE = 2048;
const MIN_RMS = 0.01;

/** 마이크 스트림 요청. 비-HTTPS 환경 가드 + 제약 미지원 기기 자동 폴백 포함 */
async function requestMicStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "마이크 API를 사용할 수 없습니다. HTTPS 또는 앱에서 실행해 주세요.",
      "NotSupportedError",
    );
  }
  try {
    // 피치 추적 최적 설정: 에코 제거·잡음 억제·자동 게인 끄기
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    // 일부 기기·브라우저는 세부 제약을 지원하지 않아 OverconstrainedError 발생 → 기본값으로 재시도
    if (e instanceof DOMException && (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError")) {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    throw e;
  }
}

export async function startPitchTracking(opts: TrackerOptions): Promise<TrackerSession> {
  const ctx = getAudioContext();
  // 마이크 요청과 동시에 AudioContext resume 완료를 보장
  const [stream] = await Promise.all([
    requestMicStream(),
    ctx.state !== "running" ? ctx.resume() : Promise.resolve(),
  ]);
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  source.connect(analyser);

  const detector = PitchDetector.forFloat32Array(FFT_SIZE);
  detector.minVolumeDecibels = -45;
  const buf = new Float32Array(FFT_SIZE);

  const spb = 60 / opts.bpm;
  const countInBeats = opts.countInMeasures * opts.beatsPerMeasure;
  const t0 = ctx.currentTime + 0.15; // 카운트인 시작
  const recordStart = t0 + countInBeats * spb; // 1마디 1박

  // 메트로놈 스케줄러 (100ms 앞까지 미리 예약)
  let nextBeat = 0;
  const scheduler = setInterval(() => {
    while (t0 + nextBeat * spb < ctx.currentTime + 0.1) {
      const isCountIn = nextBeat < countInBeats;
      if (isCountIn || opts.metronome) playClick(ctx, t0 + nextBeat * spb, nextBeat % opts.beatsPerMeasure === 0);
      nextBeat++;
    }
  }, 25);

  const frames: PitchFrame[] = [];
  let lastBeat = -Infinity;
  let raf = 0;
  const tick = () => {
    const now = ctx.currentTime;
    const beat = Math.floor((now - recordStart) / spb);
    if (beat !== lastBeat && now >= t0) {
      lastBeat = beat;
      opts.onBeat?.(beat);
    }
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const [pitch, clarity] = rms > MIN_RMS ? detector.findPitch(buf, ctx.sampleRate) : [0, 0];
    const frame: PitchFrame = {
      time: now - recordStart,
      freq: pitch > 0 && clarity > 0 ? pitch : null,
      clarity,
    };
    opts.onFrame?.(frame);
    if (frame.time >= 0) frames.push(frame);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      cancelAnimationFrame(raf);
      clearInterval(scheduler);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      return frames;
    },
  };
}
