import type { Meter } from "@/lib/music/types";

/** 새 악보 기본값 (이 기기 localStorage). 저장소를 못 쓰면 기본값 90 BPM · 4/4. */
export interface ScoreDefaults {
  bpm: number;
  meter: Meter;
}

export const PREFERENCES_KEY = "humscore.prefs.v1";
export const DEFAULT_BPM_MIN = 40;
export const DEFAULT_BPM_MAX = 200;
export const SCORE_DEFAULTS: ScoreDefaults = { bpm: 90, meter: "4/4" };

const isMeter = (v: unknown): v is Meter => v === "3/4" || v === "4/4" || v === "6/8";

/** 템포를 40~200 정수로. 숫자가 아니면 기본값 */
export function clampDefaultBpm(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return SCORE_DEFAULTS.bpm;
  return Math.min(DEFAULT_BPM_MAX, Math.max(DEFAULT_BPM_MIN, Math.round(n)));
}

export function loadScoreDefaults(): ScoreDefaults {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { ...SCORE_DEFAULTS };
    const o = JSON.parse(raw) as Partial<Record<keyof ScoreDefaults, unknown>> | null;
    return {
      bpm: o && o.bpm !== undefined ? clampDefaultBpm(o.bpm) : SCORE_DEFAULTS.bpm,
      meter: o && isMeter(o.meter) ? o.meter : SCORE_DEFAULTS.meter,
    };
  } catch {
    return { ...SCORE_DEFAULTS };
  }
}

export function saveScoreDefaults(next: Partial<ScoreDefaults>): ScoreDefaults {
  const cur = loadScoreDefaults();
  const merged: ScoreDefaults = {
    bpm: next.bpm !== undefined ? clampDefaultBpm(next.bpm) : cur.bpm,
    meter: isMeter(next.meter) ? next.meter : cur.meter,
  };
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged));
  } catch {
    /* 저장 실패는 무시 (기본값 사용) */
  }
  return merged;
}
