import { PitchDetector } from "pitchy";
import { getAudioContext, setAudioSessionType } from "./context";
import { computeLatencySec, outputLatencySec } from "./latency";
import { startClickScheduler } from "./click-scheduler";
import type { Meter, PitchFrame } from "../music/types";

/**
 * 마이크 → 실시간 피치 프레임.
 * 녹음 원본(오디오)은 어디에도 저장하지 않고, 음정 숫자만 남깁니다. (개인정보 최소화)
 */

export interface TrackerOptions {
  bpm: number;
  beatsPerMeasure: number;
  /** 박자표. 있으면 클릭 패턴(6/8 은 8분음표 6번)에 반영, 시간축은 4분음표 박 기준 그대로 */
  meter?: Meter;
  /** 녹음 전 카운트인 마디 수 */
  countInMeasures: number;
  /** 녹음 중 메트로놈 클릭 */
  metronome: boolean;
  onFrame?: (frame: PitchFrame) => void;
  /** 마이크 입력 레벨(RMS, 0~1). 입력이 들어오는지 확인하는 미터 표시용 — 어디에도 저장되지 않음 */
  onLevel?: (rms: number) => void;
  /** 현재 박(카운트인 중에는 음수) */
  onBeat?: (beat: number) => void;
  /** 사용자 지연 보정값(ms) */
  manualLatencyMs?: number;
  /** 마이크 track이 외부 요인으로 끊김(권한 회수, 기기 분리 등) */
  onEnded?: () => void;
  /** 시작 취소 신호 — 마이크 권한·워클릿 로드 대기 중 취소되면 마이크를 끄고 AbortError로 reject */
  signal?: AbortSignal;
}

export interface TrackerSession {
  /** 녹음 종료 후 프레임 반환 (time 0 = 카운트인 직후 첫 박) */
  stop: () => PitchFrame[];
}

const FFT_SIZE = 2048;
/**
 * 피치 분석을 시도하는 최소 입력 레벨(RMS). 약 -56 dBFS.
 * autoGainControl 을 끈 실제 마이크(특히 휴대폰)의 허밍은 -50 ~ -35 dBFS 수준이라
 * 예전 값 0.01(-40 dBFS)에서는 또렷한 허밍도 통째로 버려져 "음이 감지되지 않았어요"가 났습니다.
 * 잡음 걸러내기는 레벨이 아니라 clarity(≥0.88)·목소리 음역 필터가 담당합니다.
 */
export const MIN_RMS = 0.0015;

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

/** 프레임 간격(초) — 실시간(워클릿)·오프라인 분석 공용 고정 hop */
export const TRACK_HOP_SEC = 0.01;
const WORKLET_URL = "/worklets/hop-capture.js";
const WORKLET_NAME = "hop-capture";

type Detector = PitchDetector<Float32Array>;

export function createDetector(windowSize = FFT_SIZE): Detector {
  const detector = PitchDetector.forFloat32Array(windowSize);
  detector.minVolumeAbsolute = MIN_RMS; // 우리 RMS 게이트와 같은 기준 (pitchy의 dB 환산식은 전력 기준이라 직접 지정)
  return detector;
}

/** 분석 창 하나 → RMS 게이트·피치 (time 제외) */
export function analyzeWindow(buf: Float32Array, sampleRate: number, detector: Detector): Omit<PitchFrame, "time"> & { rms: number } {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const [pitch, clarity] = rms > MIN_RMS ? detector.findPitch(buf, sampleRate) : [0, 0];
  return { freq: pitch > 0 && clarity > 0 ? pitch : null, clarity, rms };
}

/** 워클릿 메시지: hop 샘플(모노)과 블록 끝 시각(오디오 시계) */
export interface HopBlock {
  samples: Float32Array;
  endTime: number;
}

/**
 * hop 블록 → 피치 프레임 변환기 (순수, 브라우저 의존 없음).
 * 최근 windowSize 샘플을 링버퍼로 유지해 블록마다 프레임 하나를 만든다.
 * time = toFrameTime(블록 끝 오디오 시각), 단조 증가 보장.
 */
export function createHopAnalyzer(
  sampleRate: number,
  toFrameTime: (audioEndTime: number) => number,
  windowSize = FFT_SIZE,
): (block: HopBlock) => PitchFrame {
  const detector = createDetector(windowSize);
  const win = new Float32Array(windowSize);
  let lastTime = -Infinity;
  return ({ samples, endTime }) => {
    const n = samples.length;
    if (n >= windowSize) {
      win.set(samples.subarray(n - windowSize));
    } else {
      win.copyWithin(0, n);
      win.set(samples, windowSize - n);
    }
    const time = Math.max(lastTime, toFrameTime(endTime));
    lastTime = time;
    return { time, ...analyzeWindow(win, sampleRate, detector) };
  };
}

/** 워클릿 로드 제한 시간(ms) — 넘으면 rAF 경로로 폴백 */
export const WORKLET_LOAD_TIMEOUT_MS = 1500;

/** p가 제한 시간 안에 끝나면 그 값, 시간 초과·실패·취소면 null (취소는 즉시) */
function settleWithin<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T | null> {
  return new Promise((resolve) => {
    const done = (v: T | null) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(v);
    };
    const onAbort = () => done(null);
    const timer = setTimeout(() => done(null), ms);
    signal?.addEventListener("abort", onAbort);
    p.then(done, () => done(null));
  });
}

const workletLoads = new WeakMap<BaseAudioContext, Promise<void>>();

/** 워클릿 노드 생성. 미지원·로드 실패면 null (rAF 경로로 폴백) */
async function createHopNode(ctx: AudioContext, hop: number, signal?: AbortSignal): Promise<AudioWorkletNode | null> {
  try {
    if (!ctx.audioWorklet || typeof AudioWorkletNode === "undefined") return null;
    let load = workletLoads.get(ctx);
    if (!load) {
      load = ctx.audioWorklet.addModule(WORKLET_URL);
      workletLoads.set(ctx, load);
      load.catch(() => workletLoads.delete(ctx));
    }
    const loaded = await settleWithin(load.then(() => true), WORKLET_LOAD_TIMEOUT_MS, signal);
    if (!loaded || signal?.aborted) return null;
    return new AudioWorkletNode(ctx, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { hop },
    });
  } catch {
    return null;
  }
}

export async function startPitchTracking(opts: TrackerOptions): Promise<TrackerSession> {
  opts.signal?.throwIfAborted();
  const ctx = getAudioContext();
  setAudioSessionType("play-and-record"); // 동기 호출: 제스처 체인 유지
  let stream: MediaStream;
  try {
    stream = await requestMicStream(); // resume은 await 금지 (iOS/Safari 제스처 체인)
  } catch (e) {
    setAudioSessionType("playback");
    throw e;
  }
  if (ctx.state !== "running") void ctx.resume();
  const hop = Math.max(1, Math.round(ctx.sampleRate * TRACK_HOP_SEC));
  const node = opts.signal?.aborted ? null : await createHopNode(ctx, hop, opts.signal); // 실패·시간 초과면 null
  if (opts.signal?.aborted) {
    // 권한·로드 대기 중 취소 → 이미 켜진 마이크를 바로 끈다
    node?.port.close();
    stream.getTracks().forEach((t) => t.stop());
    setAudioSessionType("playback");
    opts.signal.throwIfAborted();
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = node ? null : ctx.createAnalyser();
  if (node) {
    source.connect(node);
    node.connect(ctx.destination); // 출력은 무음 — 일부 브라우저가 연결 안 된 노드를 처리하지 않아 연결
  } else {
    analyser!.fftSize = FFT_SIZE;
    source.connect(analyser!);
  }

  let stopped = false;
  const onTrackEnded = () => {
    if (!stopped) opts.onEnded?.();
  };
  stream.getTracks().forEach((t) => t.addEventListener("ended", onTrackEnded));

  // 지연값은 녹음 시작 시 한 번만 계산해 고정 (연결 상태 변화로 time이 거꾸로 가는 것 방지)
  const outLatency = outputLatencySec({ outputLatency: ctx.outputLatency, baseLatency: ctx.baseLatency });
  const latency = computeLatencySec({
    outputLatency: ctx.outputLatency,
    baseLatency: ctx.baseLatency,
    fftSize: FFT_SIZE,
    sampleRate: ctx.sampleRate,
    manualMs: opts.manualLatencyMs,
  });

  const spb = 60 / opts.bpm;
  const countInBeats = opts.countInMeasures * opts.beatsPerMeasure;
  const t0 = ctx.currentTime + 0.15; // 카운트인 시작
  const recordStart = t0 + countInBeats * spb; // 1마디 1박

  // 메트로놈 스케줄러 (100ms 앞까지 미리 예약, 분수 박 클릭 포함)
  const stopScheduler = startClickScheduler(ctx, {
    spb, t0, beatsPerMeasure: opts.beatsPerMeasure, meter: opts.meter, countInBeats, metronome: opts.metronome,
  });

  const frames: PitchFrame[] = [];
  const emit = (frame: PitchFrame) => {
    opts.onLevel?.(frame.rms ?? 0);
    opts.onFrame?.(frame);
    if (frame.time >= 0) frames.push(frame);
  };

  if (node) {
    // 고정 hop: 워클릿 메시지는 메인이 잠시 멈춰도 큐에 쌓였다가 순서대로 처리돼 프레임이 빠지지 않는다
    const analyze = createHopAnalyzer(ctx.sampleRate, (end) => end - recordStart - latency);
    node.port.onmessage = (e: MessageEvent<HopBlock>) => {
      if (stopped) return;
      emit(analyze(e.data));
    };
  }

  let lastBeat = -Infinity;
  let raf = 0;
  let lastTime = -Infinity;
  const detector = createDetector();
  const buf = new Float32Array(FFT_SIZE);
  const tick = () => {
    if (stopped) return;
    const now = ctx.currentTime;
    // 박자 표시는 출력 지연만큼 늦춰 실제로 들리는 클릭에 맞춤
    const heard = now - outLatency;
    const beat = Math.floor((heard - recordStart) / spb);
    if (beat !== lastBeat && heard >= t0) {
      lastBeat = beat;
      opts.onBeat?.(beat);
    }
    if (analyser) {
      // 폴백(워클릿 미지원): analyser 최신 창만 읽는 가변 간격 경로
      analyser.getFloatTimeDomainData(buf);
      const time = Math.max(lastTime, now - recordStart - latency); // 단조 증가 보장
      lastTime = time;
      emit({ time, ...analyzeWindow(buf, ctx.sampleRate, detector) });
    }
    if (stopped) return; // onFrame·onBeat 안에서 stop() 된 경우 루프를 다시 예약하지 않는다
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      setAudioSessionType("playback");
      cancelAnimationFrame(raf);
      stopScheduler();
      if (node) {
        node.port.onmessage = null;
        node.port.postMessage("stop");
        node.port.close();
        node.disconnect();
      }
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      return frames;
    },
  };
}
