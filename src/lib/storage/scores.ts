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

export const getScoresSnapshot = readAll;

export function sortByRecent(scores: Score[]): Score[] {
  return [...scores].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getScore(id: string): Score | undefined {
  return readAll().find((s) => s.id === id);
}

export async function saveScore(score: Score): Promise<Score> {
  const updated = { ...score, updatedAt: new Date().toISOString() };
  const all = readAll().filter((s) => s.id !== score.id);
  writeAll([updated, ...all]);
  void pushToCloud(updated);
  return updated;
}

export function deleteScore(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
  writeTombstones({ ...readTombstones(), [id]: new Date().toISOString() });
  void pushDelete(id);
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
  } catch {
    /* 무시 */
  }
  writeOwner(null);
}

/** 명시적 로그아웃 준비: 밀린 변경을 올려 보고(실패해도 진행), 이 계정의 로컬 데이터를 비웁니다. */
export async function flushAndClearAccountData(): Promise<void> {
  try {
    await syncFromCloud();
  } catch {
    /* 오프라인 등 — 그래도 비움 */
  }
  clearAccountData();
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

// 서버가 invalid 로 거절한 (id, updatedAt) — 수정(updatedAt 변경)되기 전까지 재시도하지 않음
const skipped = new Set<string>();
const skipKey = (s: Score) => `${s.id}:${s.updatedAt}`;

type PushOutcome = "ok" | "skipped" | "failed" | "auth";

async function pushOne(score: Score): Promise<PushOutcome> {
  if (skipped.has(skipKey(score))) return "skipped";
  if (scoreBytes(score) > MAX_SCORE_BYTES) {
    skipped.add(skipKey(score));
    return "skipped";
  }
  const r = await saveScoreRemote(score).catch(() => null);
  if (!r) return "failed";
  if (r.ok) return "ok";
  if (r.error === "invalid") {
    skipped.add(skipKey(score));
    return "skipped";
  }
  return r.error === "unauthenticated" || r.error === "disabled" ? "auth" : "failed";
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
    return data.session?.user.id ?? null;
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
  if (!(await ownedSessionUser())) return;
  const o = await pushOne(score);
  if (o !== "auth") reportOutcomes([o]);
}

async function pushDelete(id: string) {
  if (!(await ownedSessionUser())) return;
  const r = await deleteScoreRemote(id).catch(() => null);
  if (r?.ok) clearTombstone(id);
  else if (r) setStatus({ state: "error", message: MSG_FAILED });
}

let syncing: Promise<void> | null = null;

/** 로그인 상태에서 클라우드 악보를 가져와 로컬과 병합하고, 차이를 다시 올립니다. */
export function syncFromCloud(): Promise<void> {
  if (!syncing) syncing = doSync().finally(() => (syncing = null));
  return syncing;
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

    const outcomes: PushOutcome[] = [];
    for (const id of toDelete) {
      const r = await deleteScoreRemote(id).catch(() => null);
      if (r?.ok) clearTombstone(id);
      else outcomes.push("failed");
    }
    for (const s of toPush) outcomes.push(await pushOne(s));
    reportOutcomes(outcomes);
  } catch {
    setStatus({ state: "error", message: MSG_FAILED });
  }
}
