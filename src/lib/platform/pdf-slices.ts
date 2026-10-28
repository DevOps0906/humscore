/** 세로로 긴 악보를 A4 페이지 높이(sliceH)로 나눌 때, 시스템(줄) 사이에서 자르는 계획. 순수 함수. */

export interface Span {
  top: number;
  bottom: number;
}

/** 시스템 span 들 사이의 컷 위치(틈의 중간). 잘못된 값은 걸러낸다. */
export function cutsBetween(systems: Span[], totalH: number): number[] {
  const sorted = systems
    .filter((s) => Number.isFinite(s.top) && Number.isFinite(s.bottom) && s.bottom > s.top)
    .sort((a, b) => a.top - b.top);
  const cuts: number[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const c = (sorted[i].bottom + sorted[i + 1].top) / 2;
    if (c > 0 && c < totalH) cuts.push(c);
  }
  return cuts;
}

/**
 * 그리디 패킹: 한 페이지에 sliceH 안에서 가능한 한 많은 시스템을 담는다.
 * 컷 중 start 보다 크고 start+sliceH 이하인 가장 큰 값에서 자르고, 없으면(시스템 하나가 더 큼) sliceH 로 고정 분할.
 * 반환: [start, end] 구간들 (끝이 totalH).
 */
export function planSlices(totalH: number, sliceH: number, cuts: number[]): [number, number][] {
  const sorted = [...cuts].sort((a, b) => a - b);
  const out: [number, number][] = [];
  let start = 0;
  while (start < totalH - 0.5) {
    const limit = start + sliceH;
    if (limit >= totalH) {
      out.push([start, totalH]);
      break;
    }
    let end = limit;
    for (const c of sorted) if (c > start + 1 && c <= limit) end = c;
    out.push([start, end]);
    start = end;
  }
  return out;
}
