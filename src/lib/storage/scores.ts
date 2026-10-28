import type { Score } from "../music/types";
import { deleteScore as deleteScoreRemote, listScores, saveScore as saveScoreRemote } from "@/app/actions/scores";
import { mergeScores, type Tombstones } from "./merge";
import { MAX_SCORE_BYTES, parseScore, scoreBytes } from "./score-schema";
import { getSupabase } from "./supabase/client";

/**
 * 악보 저장소
 *  - MVP 기본: 기기 로컬(localStorage) — 로그인 없이 바로 테스트 가능
 *  - Supabase 환경변수가 있고 로그인 상태면 Server Action 으로 클라우드와 동기화
 *    (시작/로그인 시 pull → id 기준 updatedAt 최신 우선 병합, 삭제는 tombstone 으로 전파)
 * 화면 코드는 이 모듈만 호출하므로, 저장 방식이 바뀌어도 UI는 그대로입니다.
 */

const KEY = "humscore.scores.v1";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedList: Score[] = [];

function readAll(): Score[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedList; // useSyncExternalStore는 같은 참조를 요구
    cachedRaw = raw;
    cachedList = raw ? (JSON.parse(raw) as Score[]) : [];
    return cachedList;
  } catch {
    return cachedList;
  }
}

function writeAll(scores: Score[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(scores));
  } catch {
    /* 저장 공간 부족 등 — MVP에서는 무시 */
  }
  listeners.forEach((l) => l());
}

/** React 구독용 (useSyncExternalStore) */
export function subscribeScores(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage); // 다른 탭에서 바뀐 경우
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// 현재 세션 uid 캐시(동기 접근용). undefined = 아직 모름, null = 로그아웃 상태
let cachedUid: string | null | undefined;
const EMPTY: Score[] = [];

/** CloudSync 가 auth 상태 변경 때 호출 — 바뀌면 목록 구독자에게 알린다 */
export function setSessionUserId(uid: string | null) {
  if (cachedUid === uid) return;
  cachedUid = uid;
  listeners.forEach((l) => l());
}

/** 이 기기 데이터의 주인이 현재 로그인한 다른 계정이면 true (오프라인에서도 이전 계정 악보를 보이지 않기 위함) */
function isForeignData(): boolean {
  const owner = readOwner();
  return !!owner && typeof cachedUid === "string" && owner !== cachedUid;
}

/** 다른 계정의 잔여 로컬 데이터 위에 쓰기 전에 비우고 현재 계정 소유로 만든다 (새 악보가 이후 정리에서 지워지지 않게) */
function adoptIfForeign() {
  if (!isForeignData()) return;
  clearAccountData();
  writeOwner(cachedUid as string);
}

export function getScoresSnapshot(): Score[] {
  const all = readAll();
  return isForeignData() ? EMPTY : all;
}

export function sortByRecent(scores: Score[]): Score[] {
  return [...scores].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getScore(id: string): Score | undefined {
  return getScoresSnapshot().find((s) => s.id === id);
}

export async function saveScore(score: Score): Promise<Score> {
  adoptIfForeign();
  // 시계가 늦은 기기에서도 기존 버전보다 항상 커야 서버 LWW 가드를 통과한다
  const prev = readAll().find((s) => s.id === score.id);
  const prevMs = prev ? Date.parse(prev.updatedAt) : NaN;
  const nowMs = Math.max(Date.now(), Number.isFinite(prevMs) ? prevMs + 1 : 0);
  const updated = { ...score, updatedAt: new Date(nowMs).toISOString() };
  const all = readAll().filter((s) => s.id !== score.id);
  writeAll([updated, ...all]);
  markDirty(updated.id, updated.updatedAt);
  void pushToCloud(updated);
  return updated;
}

export function deleteScore(id: string) {
  adoptIfForeign();
  writeAll(readAll().filter((s) => s.id !== id));
  writeTombstones({ ...readTombstones(), [id]: new Date().toISOString() });
  markDirty(id, DELETED);
  void pushDelete(id);
}

// ── 아직 올리지 못한 변경(dirty): id → 버전(updatedAt 또는 "deleted") ──
const DIRTY_KEY = "humscore.dirty.v1";
const DELETED = "deleted";

function readDirty(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DIRTY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeDirty(d: Record<string, string>) {
  try {
    if (Object.keys(d).length) localStorage.setItem(DIRTY_KEY, JSON.stringify(d));
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* 무시 */
  }
}

function markDirty(id: string, version: string) {
  writeDirty({ ...readDirty(), [id]: version });
}

/** 같은 버전일 때만 제거 — 그 사이 다시 수정됐다면 dirty 유지 */
function clearDirty(id: string, version: string) {
  const d = readDirty();
  if (d[id] !== version) return;
  delete d[id];
  writeDirty(d);
}

// 서버가 invalid 로 거절한 (id, updatedAt) — 수정(updatedAt 변경)되기 전까지 재시도하지 않음
const skipped = new Set<string>();
const skipKey = (s: Pick<Score, "id" | "updatedAt">) => `${s.id}:${s.updatedAt}`;

/** 올리지 못한 변경 중 용량 초과·형식 오류로 올릴 수 없는 악보 수 */
export function getUnsyncableCount(): number {
  return Object.entries(readDirty()).filter(([id, v]) => v !== DELETED && skipped.has(skipKey({ id, updatedAt: v }))).length;
}

/** 재시도하면 올라갈 수 있는 미동기화 변경 수 (올릴 수 없는 악보 제외) */
export function getDirtyCount(): number {
  return Object.keys(readDirty()).length - getUnsyncableCount();
}

// ── 삭제 기록 / 소유자 ─────────────────────────────────────
const TOMB_KEY = "humscore.deleted.v1";
const OWNER_KEY = "humscore.owner.v1";

function readTombstones(): Tombstones {
  try {
    const raw = localStorage.getItem(TOMB_KEY);
    return raw ? (JSON.parse(raw) as Tombstones) : {};
  } catch {
    return {};
  }
}

function writeTombstones(t: Tombstones) {
  try {
    localStorage.setItem(TOMB_KEY, JSON.stringify(t));
  } catch {
    /* 무시 */
  }
}

function clearTombstone(id: string) {
  const t = readTombstones();
  delete t[id];
  writeTombstones(t);
}

/** 이 기기의 로컬 데이터 소유자(user.id). 없으면 익명(로그인 전) 데이터. */
function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* 무시 */
  }
}

/** 로컬 악보·삭제 기록·소유자를 모두 비웁니다 (로그아웃/계정 전환 시 다른 사람에게 노출되지 않도록). */
export function clearAccountData() {
  writeAll([]);
  try {
    localStorage.removeItem(TOMB_KEY);
    localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* 무시 */
  }
  writeOwner(null);
}

/** 로그아웃 준비: 밀린 변경을 올려 보고, 그래도 올리지 못한 악보 수(일반/올릴 수 없는 악보)를 돌려줍니다(지우는 것은 호출자가 clearAccountData 로). */
export async function flushPendingChanges(): Promise<{ pending: number; unsyncable: number }> {
  try {
    await syncFromCloud();
  } catch {
    /* 오프라인 등 — 남은 수로 판단 */
  }
  return { pending: getDirtyCount(), unsyncable: getUnsyncableCount() };
}

// ── 동기화 상태 ────────────────────────────────────────────
export type SyncStatus = { state: "idle" | "syncing" | "error"; message?: string };
let syncStatus: SyncStatus = { state: "idle" };
const statusListeners = new Set<() => void>();

function setStatus(next: SyncStatus) {
  syncStatus = next;
  statusListeners.forEach((l) => l());
}
export const getSyncStatus = (): SyncStatus => syncStatus;
export function subscribeSyncStatus(l: () => void): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

const MSG_FAILED = "클라우드 동기화에 실패했어요. 나중에 자동으로 다시 시도해요.";
const MSG_SKIPPED = "일부 악보가 너무 크거나 형식이 맞지 않아 동기화하지 못했어요.";

type PushOutcome = "ok" | "skipped" | "failed" | "auth";

let resyncTimer: ReturnType<typeof setTimeout> | null = null;
const RESYNC_DELAY_MS = 5000;
function scheduleResync() {
  if (resyncTimer) return;
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    void syncFromCloud();
  }, RESYNC_DELAY_MS);
}

async function pushOne(score: Score, uid: string): Promise<PushOutcome> {
  if (skipped.has(skipKey(score))) return "skipped";
  if (scoreBytes(score) > MAX_SCORE_BYTES) {
    skipped.add(skipKey(score));
    return "skipped";
  }
  const r = await saveScoreRemote(score, uid).catch(() => null);
  if (!r) return "failed";
  if (r.ok) {
    clearDirty(score.id, score.updatedAt);
    return "ok";
  }
  if (r.error === "stale") {
    scheduleResync(); // 서버에 더 새로운 버전이 있음 — 다시 받아 병합
    return "failed";
  }
  if (r.error === "invalid") {
    skipped.add(skipKey(score));
    return "skipped";
  }
  return r.error === "unauthenticated" || r.error === "disabled" || r.error === "mismatch" ? "auth" : "failed";
}

function reportOutcomes(outcomes: PushOutcome[]) {
  if (outcomes.includes("failed")) setStatus({ state: "error", message: MSG_FAILED });
  else if (outcomes.includes("skipped")) setStatus({ state: "error", message: MSG_SKIPPED });
  else setStatus({ state: "idle" });
}

// ── 클라우드 동기화 (Score 음표 데이터만 — 오디오는 절대 전송하지 않음) ──
async function sessionUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user.id ?? null;
    setSessionUserId(uid);
    return uid;
  } catch {
    return null;
  }
}

/** 현재 로그인 사용자가 이 로컬 데이터의 주인이면 id, 아니면 null (익명 데이터는 주인이 됨) */
async function ownedSessionUser(): Promise<string | null> {
  const uid = await sessionUserId();
  if (!uid) return null;
  const owner = readOwner();
  if (owner && owner !== uid) return null; // 다른 사람 데이터 — doSync 가 정리하기 전엔 건드리지 않음
  if (!owner) writeOwner(uid);
  return uid;
}

async function pushToCloud(score: Score) {
  const uid = await ownedSessionUser();
  if (!uid) return;
  const o = await pushOne(score, uid);
  if (o !== "auth") reportOutcomes([o]);
}

async function pushDelete(id: string) {
  const uid = await ownedSessionUser();
  if (!uid) return;
  const r = await deleteScoreRemote(id, uid).catch(() => null);
  if (r?.ok) {
    clearTombstone(id);
    clearDirty(id, DELETED);
  } else if (r && r.error !== "mismatch") setStatus({ state: "error", message: MSG_FAILED });
}

let syncing: Promise<void> | null = null;
let rerun = false;
let lastSyncAt = 0;
const MAX_RERUNS = 3;
export const SYNC_MIN_INTERVAL_MS = 30_000;

/** 로그인 상태에서 클라우드 악보를 가져와 로컬과 병합하고, 차이를 다시 올립니다. 진행 중에 불리면 끝난 뒤 1회 더 실행합니다. */
export function syncFromCloud(): Promise<void> {
  if (syncing) {
    rerun = true;
    return syncing;
  }
  lastSyncAt = Date.now();
  syncing = (async () => {
    let runs = 0;
    do {
      rerun = false;
      await doSync();
    } while (rerun && ++runs < MAX_RERUNS);
  })().finally(() => (syncing = null));
  return syncing;
}

/** 자동 재시도용(online·화면 복귀): 마지막 동기화 시작 후 최소 간격이 지났을 때만 실행 */
export function syncIfStale(minIntervalMs = SYNC_MIN_INTERVAL_MS): Promise<void> {
  if (syncing || Date.now() - lastSyncAt < minIntervalMs) return Promise.resolve();
  return syncFromCloud();
}

async function doSync() {
  const uid = await sessionUserId();
  if (!uid) return;
  setStatus({ state: "syncing" });
  try {
    const res = await listScores().catch(() => null);
    if (!res || !res.ok) {
      setStatus(res && !res.ok && (res.error === "unauthenticated" || res.error === "disabled") ? { state: "idle" } : { state: "error", message: MSG_FAILED });
      return;
    }
    const { scores: cloud, tombstones: cloudTombstones } = res.data;

    // 다른 탭에서 로그아웃·계정 전환이 끝났다면 이 결과로 로컬을 되살리지 않는다
    if ((await sessionUserId()) !== res.data.userId) return;

    // 소유자 확인: 다른 계정 데이터는 병합/업로드하지 않고 폐기(그 계정의 클라우드에 이미 있음)
    const owner = readOwner();
    if (owner && owner !== res.data.userId) clearAccountData();
    writeOwner(res.data.userId);

    // 로컬 데이터 검증: 깨진 항목은 버림
    const rawLocal = readAll();
    const local = rawLocal.map((s) => parseScore(s)).filter((s): s is Score => s !== null);
    if (local.length !== rawLocal.length) writeAll(local);

    const { merged, toPush, toDelete, clearTombstones } = mergeScores({
      local,
      cloud,
      localTombstones: readTombstones(),
      cloudTombstones,
    });
    writeAll(merged);
    clearTombstones.forEach(clearTombstone);

    // 이번 병합 결과로 dirty 를 다시 정의(클라우드가 이긴 항목은 더 이상 올릴 게 없음)
    const dirty: Record<string, string> = {};
    toDelete.forEach((id) => (dirty[id] = DELETED));
    toPush.forEach((s) => (dirty[s.id] = s.updatedAt));
    writeDirty(dirty);

    if ((await sessionUserId()) !== res.data.userId) return; // push 직전 재확인

    // 요청 시작 계정(uid) 고정: 도중에 쿠키가 다른 계정으로 바뀌면 서버가 mismatch 로 거절 → 즉시 중단
    const uid = res.data.userId;
    const outcomes: PushOutcome[] = [];
    let aborted = false;
    for (const id of toDelete) {
      const r = await deleteScoreRemote(id, uid).catch(() => null);
      if (r?.ok) {
        clearTombstone(id);
        clearDirty(id, DELETED);
      } else if (r && !r.ok && (r.error === "mismatch" || r.error === "unauthenticated" || r.error === "disabled")) {
        aborted = true;
        break;
      } else outcomes.push("failed");
    }
    if (!aborted) {
      for (const s of toPush) {
        const o = await pushOne(s, uid);
        if (o === "auth") {
          aborted = true;
          break;
        }
        outcomes.push(o);
      }
    }
    if (aborted) {
      rerun = true; // 계정이 바뀌었을 수 있음 — 새 계정으로 처음부터 다시
      setStatus({ state: "idle" });
      return;
    }
    reportOutcomes(outcomes);
  } catch {
    setStatus({ state: "error", message: MSG_FAILED });
  }
}
