/** 출력 지연 보정 계산 (순수 함수, 브라우저 의존 없음) */

export interface LatencyInput {
  outputLatency?: number;
  baseLatency?: number;
  fftSize?: number;
  sampleRate?: number;
  /** 사용자 수동 보정값(ms) */
  manualMs?: number;
}

function num(v: number | undefined | null): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** 자동 출력 지연(초): outputLatency 우선, 없거나 0이면 baseLatency */
export function outputLatencySec({ outputLatency, baseLatency }: Pick<LatencyInput, "outputLatency" | "baseLatency">): number {
  return Math.max(0, num(outputLatency) || num(baseLatency));
}

/** 총 지연(초) = 출력 지연 + 분석 윈도 지연(fftSize/2/sampleRate) + 수동 보정 */
export function computeLatencySec(input: LatencyInput): number {
  const sr = num(input.sampleRate);
  const windowSec = sr > 0 ? num(input.fftSize) / 2 / sr : 0;
  const manual = Math.max(0, num(input.manualMs)) / 1000;
  return Math.max(0, outputLatencySec(input) + windowSec + manual);
}

export const LATENCY_STORAGE_KEY = "humscore.latencyMs";

export function loadManualLatencyMs(): number {
  try {
    const raw = localStorage.getItem(LATENCY_STORAGE_KEY);
    const v = raw === null ? 0 : Number(raw);
    return Number.isFinite(v) ? Math.min(400, Math.max(0, v)) : 0;
  } catch {
    return 0;
  }
}

export function saveManualLatencyMs(ms: number): void {
  try {
    localStorage.setItem(LATENCY_STORAGE_KEY, String(ms));
  } catch {
    /* 저장 실패는 무시 (기본값 0 사용) */
  }
}
