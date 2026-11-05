/**
 * 지속음 악기(관악·현악·보컬·패드·오르간 등)의 음 길이 조절. 브라우저 의존 없는 순수 계산과 저장값만 둔다.
 * 피아노·기타·타악기처럼 스스로 감쇠하는 소리는 건드리지 않는다.
 */

export const SUSTAIN_MIN = 0.2;
export const SUSTAIN_MAX = 1;
export const SUSTAIN_DEFAULT = 1;
export const SUSTAIN_STEP = 0.05;

/** 목관·금관은 숨이 끊기는 자리를 두어 다음 음과 겹쳐 길게 이어지지 않게 한다. */
export const WIND_BRASS_GATE = 0.9;
/** 목관·금관을 길이 없이 짧게 눌렀을 때(건반 미리듣기) 내는 시간(초) */
export const WIND_BRASS_TAP_HOLD = 0.45;
export const DEFAULT_TAP_HOLD = 0.8;
/** 어떤 설정에서도 이보다 짧게 끊지 않는다(클릭 소리 방지) */
export const MIN_HOLD = 0.08;

export function clampSustain(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return SUSTAIN_DEFAULT;
  return Math.min(SUSTAIN_MAX, Math.max(SUSTAIN_MIN, Math.round(value / SUSTAIN_STEP) * SUSTAIN_STEP));
}

/**
 * 지속음의 실제 서스테인 시간(초).
 * @param duration 악보상 음 길이(초). 없으면 건반 미리듣기로 보고 기본 시간을 쓴다.
 * @param ratio 슬라이더 값(0.2~1). 1이면 악보 길이 그대로.
 * @param windBrass 목관·금관이면 숨 쉬는 자리(gate)를 추가로 둔다.
 */
export function heldDuration(duration: number | undefined, ratio: number, windBrass: boolean): number {
  const base = duration !== undefined && Number.isFinite(duration) && duration > 0 ? duration : windBrass ? WIND_BRASS_TAP_HOLD : DEFAULT_TAP_HOLD;
  const gate = windBrass && duration !== undefined ? WIND_BRASS_GATE : 1;
  return Math.max(MIN_HOLD, base * clampSustain(ratio) * gate);
}

const STORAGE_KEY = "humscore.sustainRatio";
let current = SUSTAIN_DEFAULT;
let loaded = false;

/** 재생 때마다 쓰는 현재 비율. 처음 한 번은 저장값을 읽어 슬라이더가 없는 화면(공연·공유)에도 적용한다. */
export function getSustainRatio(): number {
  if (!loaded) { loaded = true; loadSustainRatio(); }
  return current;
}

/** 값을 맞춰 보관하고 localStorage 에 저장한다. 이후 재생되는 모든 지속음에 적용된다. */
export function setSustainRatio(value: number): number {
  loaded = true;
  current = clampSustain(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(current));
  } catch {
    /* 저장소 접근 불가 — 이번 세션에만 적용 */
  }
  return current;
}

export function loadSustainRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) current = clampSustain(Number(raw));
  } catch {
    /* 기본값 유지 */
  }
  return current;
}
