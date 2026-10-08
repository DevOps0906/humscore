import type { Score } from "../music/types";
import { getSupabase } from "./supabase";

/**
 * 악보 저장소
 *  - MVP 기본: 기기 로컬(localStorage) — 로그인 없이 바로 테스트 가능
 *  - Supabase 환경변수가 있고 로그인 상태면 클라우드에도 동기화 (upsert)
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
  void syncToCloud(updated);
  return updated;
}

export function deleteScore(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
  const sb = getSupabase();
  if (sb) void sb.from("scores").delete().eq("id", id);
}

async function syncToCloud(score: Score) {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  await sb.from("scores").upsert({
    id: score.id,
    user_id: data.user.id,
    title: score.title,
    data: score,
    updated_at: score.updatedAt,
  });
}
