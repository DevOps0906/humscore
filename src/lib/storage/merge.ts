import type { Score } from "../music/types";

/** 로컬 삭제 기록: id → 삭제 시각(ISO). 오프라인/로그아웃 중 삭제도 전파하기 위함. */
export type Tombstones = Record<string, string>;

/** 서버(소프트 삭제된 행)에서 내려오는 삭제 기록 */
export interface CloudTombstone {
  id: string;
  updatedAt: string;
  deletedAt: string;
}

export interface MergeInput {
  local: Score[];
  cloud: Score[];
  localTombstones?: Tombstones;
  cloudTombstones?: CloudTombstone[];
}

export interface MergeResult {
  /** 병합 결과(로컬에 저장할 목록, 최신순) */
  merged: Score[];
  /** 클라우드에 올릴 악보(로컬에만 있거나 로컬이 더 최신 — 클라우드 삭제 기록보다 새 수정 포함) */
  toPush: Score[];
  /** 클라우드에서 삭제해야 할 id (로컬 삭제 기록이 아직 반영되지 않은 것) */
  toDelete: string[];
  /** 더 이상 필요 없는 로컬 삭제 기록 id (이미 서버에 있거나 이후 수정으로 되살아남) */
  clearTombstones: string[];
}

/** ISO 문자열 → 밀리초. 문자열 비교 대신 항상 Date.parse (오프셋/자릿수 차이 대응). 파싱 실패는 0. */
export function ts(iso: string | undefined): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 순수 병합 (id 단위):
 *  - 생존 시각 = 로컬/클라우드 악보 updatedAt 중 최신, 삭제 시각 = 로컬/클라우드 삭제 기록 중 최신
 *  - 삭제 시각 >= 생존 시각 → 삭제됨, 아니면 살아남음(더 최신인 쪽 승, 동률은 로컬)
 */
export function mergeScores({ local, cloud, localTombstones = {}, cloudTombstones = [] }: MergeInput): MergeResult {
  const L = new Map(local.map((s) => [s.id, s]));
  const C = new Map(cloud.map((s) => [s.id, s]));
  const R = new Map(cloudTombstones.map((t) => [t.id, Math.max(ts(t.deletedAt), ts(t.updatedAt))]));
  const ids = new Set([...L.keys(), ...C.keys(), ...Object.keys(localTombstones), ...R.keys()]);

  const merged: Score[] = [];
  const toPush: Score[] = [];
  const toDelete: string[] = [];
  const clearTombstones: string[] = [];

  for (const id of ids) {
    const l = L.get(id);
    const c = C.get(id);
    const lt = id in localTombstones ? ts(localTombstones[id]) : undefined;
    const rt = R.get(id);
    const alive = Math.max(ts(l?.updatedAt), ts(c?.updatedAt));
    const death = Math.max(lt ?? Number.NEGATIVE_INFINITY, rt ?? Number.NEGATIVE_INFINITY);

    if (death > Number.NEGATIVE_INFINITY && death >= alive) {
      if (lt !== undefined && rt === undefined) toDelete.push(id);
      else if (lt !== undefined) clearTombstones.push(id);
      continue;
    }

    if (lt !== undefined) clearTombstones.push(id); // 삭제 후 다시 수정됨 → 되살림
    if (l && (!c || ts(l.updatedAt) >= ts(c.updatedAt))) {
      merged.push(l);
      if (!c || ts(l.updatedAt) > ts(c.updatedAt)) toPush.push(l);
    } else if (c) {
      merged.push(c);
    }
  }

  merged.sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));
  return { merged, toPush, toDelete, clearTombstones };
}
