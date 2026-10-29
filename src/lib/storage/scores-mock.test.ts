import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Score } from "../music/types";

const mk = (id: string, title = id): Score => ({
  id, title, bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

const remote = { listScores: vi.fn(), saveScore: vi.fn(), deleteScore: vi.fn() };
vi.mock("@/app/actions/scores", () => ({
  listScores: (...a: unknown[]) => remote.listScores(...a),
  saveScore: (...a: unknown[]) => remote.saveScore(...a),
  deleteScore: (...a: unknown[]) => remote.deleteScore(...a),
}));

let store: Map<string, string>;
const REAL = JSON.stringify([mk("real-1", "실제 계정 악보")]);

async function load() {
  vi.resetModules();
  return await import("./scores");
}

// 첫 테스트 안에서 scores·@supabase/ssr 를 처음 변환·로드하면(~1s, 병렬 부하 때 5s 초과) 시간 초과로 실패 → 미리 데워 둔다.
// resetModules 는 모듈 레지스트리만 비우고 변환 캐시는 남으므로 이후 load() 는 빠르다.
beforeAll(async () => {
  await import("./scores");
}, 60_000);

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test");
  Object.values(remote).forEach((f) => f.mockReset());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("체험(mock) 로그인과 실제 계정 데이터 분리", () => {
  it("소유자가 있는 실제 계정 악보는 목록·조회에서 숨김", async () => {
    store.set("humscore.scores.v1", REAL);
    store.set("humscore.owner.v1", "real-user");
    const m = await load();
    expect(m.getScoresSnapshot()).toEqual([]);
    expect(m.getScore("real-1")).toBeUndefined();
  });

  it("저장·삭제는 체험 키에만 — 실제 계정 악보·동기화 기록·소유자는 그대로, 서버 호출 없음", async () => {
    store.set("humscore.scores.v1", REAL);
    store.set("humscore.owner.v1", "real-user");
    const m = await load();
    await m.saveScore(mk("mock-1"));
    m.deleteScore("real-1");
    expect(m.getScoresSnapshot().map((s) => s.id)).toEqual(["mock-1"]);
    expect(store.get("humscore.scores.v1")).toBe(REAL);
    expect(store.get("humscore.owner.v1")).toBe("real-user");
    expect(store.has("humscore.dirty.v1")).toBe(false);
    expect(store.has("humscore.deleted.v1")).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(remote.saveScore).not.toHaveBeenCalled();
    expect(remote.deleteScore).not.toHaveBeenCalled();
  });

  it("소유자 없는(익명) 로컬 악보는 체험 로그인에서도 그대로 보임", async () => {
    store.set("humscore.scores.v1", REAL);
    const m = await load();
    expect(m.getScoresSnapshot().map((s) => s.id)).toEqual(["real-1"]);
  });

  it("mock=0 이면 기존 동작(실제 계정 악보 표시)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "0");
    store.set("humscore.scores.v1", REAL);
    store.set("humscore.owner.v1", "real-user");
    const m = await load();
    expect(m.getScoresSnapshot().map((s) => s.id)).toEqual(["real-1"]);
  });
});
