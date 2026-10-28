import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Score } from "../music/types";

const ID = (c: string) => `${c.padEnd(8, "0")}-1111-4111-8111-111111111111`;
const mk = (id: string, updatedAt: string, title = id): Score => ({
  id, title, bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt,
});

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const remote = {
  listScores: vi.fn(),
  saveScore: vi.fn(),
  deleteScore: vi.fn(),
};
let sessionUid: string | null = "A";

vi.mock("@/app/actions/scores", () => ({
  listScores: (...a: unknown[]) => remote.listScores(...a),
  saveScore: (...a: unknown[]) => remote.saveScore(...a),
  deleteScore: (...a: unknown[]) => remote.deleteScore(...a),
}));
vi.mock("./supabase/client", () => ({
  getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: sessionUid ? { user: { id: sessionUid } } : null } }) } }),
}));

async function load() {
  vi.resetModules();
  return await import("./scores");
}

const list = (userId: string, scores: Score[] = [], tombstones: unknown[] = []) => ({ ok: true, data: { userId, scores, tombstones } });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_AUTH_MOCK", "0"); // 실제 로그인 동기화 경로를 검사
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  remote.listScores.mockReset();
  remote.saveScore.mockReset().mockResolvedValue({ ok: true, data: { id: "x" } });
  remote.deleteScore.mockReset().mockResolvedValue({ ok: true, data: { id: "x" } });
  sessionUid = "A";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("1. 계정 전환 유출 방지", () => {
  it("push 는 목록을 받은 계정(expectedUserId)을 함께 보낸다", async () => {
    const m = await load();
    remote.listScores.mockResolvedValue(list("A"));
    localStorage.setItem("humscore.scores.v1", JSON.stringify([mk(ID("a"), "2026-02-01T00:00:00.000Z")]));
    await m.syncFromCloud();
    expect(remote.saveScore).toHaveBeenCalledWith(expect.objectContaining({ id: ID("a") }), "A");
  });

  it("mismatch 를 받으면 나머지 push 를 즉시 중단하고 새 계정으로 1회 재실행한다", async () => {
    const m = await load();
    localStorage.setItem(
      "humscore.scores.v1",
      JSON.stringify([mk(ID("a"), "2026-02-01T00:00:00.000Z"), mk(ID("b"), "2026-02-02T00:00:00.000Z"), mk(ID("c"), "2026-02-03T00:00:00.000Z")]),
    );
    remote.listScores.mockResolvedValueOnce(list("A")).mockResolvedValue(list("B"));
    remote.saveScore.mockResolvedValueOnce({ ok: true, data: { id: "x" } }).mockResolvedValue({ ok: false, error: "mismatch" });
    await m.syncFromCloud();
    // 첫 실행: 1건 성공 + 1건 mismatch 후 중단(3번째 호출 없음) → 재실행에서 B 로 listScores
    expect(remote.listScores).toHaveBeenCalledTimes(2);
    const firstRunCalls = remote.saveScore.mock.calls.filter((c) => c[1] === "A");
    expect(firstRunCalls.length).toBe(2);
    expect(remote.saveScore.mock.calls.every((c) => c[1] === "A")).toBe(true); // B 로 A 악보를 보낸 호출 없음
  });

  it("진행 중 syncFromCloud 호출은 삼켜지지 않고 끝난 뒤 1회 더 실행된다", async () => {
    const m = await load();
    let release!: () => void;
    remote.listScores.mockImplementationOnce(() => new Promise((r) => (release = () => r(list("A")))));
    remote.listScores.mockResolvedValue(list("B"));
    const p1 = m.syncFromCloud();
    await flush();
    const p2 = m.syncFromCloud();
    release();
    await Promise.all([p1, p2]);
    expect(remote.listScores).toHaveBeenCalledTimes(2);
  });

  it("삭제 푸시도 expectedUserId 를 보내고 mismatch 면 중단한다", async () => {
    const m = await load();
    localStorage.setItem("humscore.deleted.v1", JSON.stringify({ [ID("d1")]: "2026-02-01T00:00:00.000Z", [ID("d2")]: "2026-02-01T00:00:00.000Z" }));
    remote.listScores.mockResolvedValueOnce(list("A", [mk(ID("d1"), "2026-01-01T00:00:00.000Z"), mk(ID("d2"), "2026-01-01T00:00:00.000Z")]));
    remote.listScores.mockResolvedValue(list("B"));
    remote.deleteScore.mockResolvedValue({ ok: false, error: "mismatch" });
    await m.syncFromCloud();
    expect(remote.deleteScore.mock.calls.filter((c) => c[1] === "A")).toHaveLength(1);
  });
});

describe("2. 시계 지연 유실 방지", () => {
  it("로컬 저장은 기존 updatedAt 보다 항상 큰 값을 쓴다", async () => {
    const m = await load();
    sessionUid = null;
    const future = new Date(Date.now() + 60_000).toISOString();
    localStorage.setItem("humscore.scores.v1", JSON.stringify([mk(ID("a"), future)]));
    const saved = await m.saveScore(mk(ID("a"), future));
    expect(Date.parse(saved.updatedAt)).toBe(Date.parse(future) + 1);
  });

  it("서버가 stale 이면 error 상태 + 재동기화 예약, dirty 유지", async () => {
    vi.useFakeTimers();
    const m = await load();
    remote.saveScore.mockResolvedValue({ ok: false, error: "stale" });
    remote.listScores.mockResolvedValue(list("A"));
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await vi.advanceTimersByTimeAsync(0);
    expect(m.getSyncStatus().state).toBe("error");
    expect(m.getDirtyCount()).toBe(1);
    expect(remote.listScores).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);
    expect(remote.listScores).toHaveBeenCalled();
  });
});

describe("3. 올리지 못한 변경 추적", () => {
  it("저장하면 dirty, 푸시 성공하면 제거", async () => {
    const m = await load();
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await flush();
    expect(m.getDirtyCount()).toBe(0);
  });

  it("푸시 실패 시 dirty 가 남고 flushPendingChanges 가 남은 수를 돌려준다", async () => {
    const m = await load();
    remote.saveScore.mockResolvedValue({ ok: false, error: "failed" });
    remote.listScores.mockResolvedValue(list("A"));
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await m.saveScore(mk(ID("b"), "2026-01-01T00:00:00.000Z"));
    await flush();
    expect(await m.flushPendingChanges()).toEqual({ pending: 2, unsyncable: 0 });
  });

  it("flush 중 재시도가 성공하면 0", async () => {
    const m = await load();
    remote.saveScore.mockResolvedValueOnce({ ok: false, error: "failed" });
    remote.listScores.mockResolvedValue(list("A"));
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await flush();
    expect(m.getDirtyCount()).toBe(1);
    expect(await m.flushPendingChanges()).toEqual({ pending: 0, unsyncable: 0 });
  });

  it("삭제도 추적되고 clearAccountData 가 dirty 를 비운다", async () => {
    const m = await load();
    remote.deleteScore.mockResolvedValue({ ok: false, error: "failed" });
    localStorage.setItem("humscore.scores.v1", JSON.stringify([mk(ID("a"), "2026-01-01T00:00:00.000Z")]));
    m.deleteScore(ID("a"));
    await flush();
    expect(m.getDirtyCount()).toBe(1);
    m.clearAccountData();
    expect(m.getDirtyCount()).toBe(0);
  });
});

describe("4. 자동 재시도 간격", () => {
  it("syncIfStale 은 30초 안에는 다시 실행하지 않는다", async () => {
    vi.useFakeTimers();
    const m = await load();
    remote.listScores.mockResolvedValue(list("A"));
    await m.syncFromCloud();
    await m.syncIfStale();
    expect(remote.listScores).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    await m.syncIfStale();
    expect(remote.listScores).toHaveBeenCalledTimes(2);
  });
});

describe("리뷰 반영", () => {
  it("1. 응답 뒤 세션이 바뀌었으면(다른 탭 로그아웃) 로컬을 되살리지 않는다", async () => {
    const m = await load();
    remote.listScores.mockImplementation(async () => {
      sessionUid = null; // listScores 도중 로그아웃
      return list("A", [mk(ID("a"), "2026-02-01T00:00:00.000Z")]);
    });
    await m.syncFromCloud();
    expect(localStorage.getItem("humscore.scores.v1")).toBeNull();
    expect(localStorage.getItem("humscore.owner.v1")).toBeNull();
    expect(remote.saveScore).not.toHaveBeenCalled();
  });

  it("2. 주인이 다른 세션이면 이전 계정 악보를 보이지 않고, 새로 저장하면 B 소유가 된다", async () => {
    const m = await load();
    localStorage.setItem("humscore.owner.v1", "A");
    localStorage.setItem("humscore.scores.v1", JSON.stringify([mk(ID("a"), "2026-01-01T00:00:00.000Z")]));
    expect(m.getScoresSnapshot()).toHaveLength(1);
    sessionUid = "B";
    m.setSessionUserId("B");
    expect(m.getScoresSnapshot()).toEqual([]);
    expect(m.getScore(ID("a"))).toBeUndefined();
    await m.saveScore(mk(ID("b"), "2026-01-02T00:00:00.000Z"));
    expect(localStorage.getItem("humscore.owner.v1")).toBe("B");
    expect(m.getScoresSnapshot().map((s) => s.id)).toEqual([ID("b")]);
    // 다음 doSync 에서도 B 악보는 지워지지 않는다
    remote.listScores.mockResolvedValue(list("B"));
    sessionUid = "B";
    await m.syncFromCloud();
    expect(m.getScoresSnapshot().map((s) => s.id)).toEqual([ID("b")]);
  });

  it("3. 올릴 수 없는 악보(invalid)는 일반 미동기화 수와 구분해 센다", async () => {
    const m = await load();
    remote.listScores.mockResolvedValue(list("A"));
    remote.saveScore.mockImplementation(async (s: Score) =>
      s.id === ID("a") ? { ok: false, error: "invalid" } : { ok: false, error: "failed" },
    );
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await m.saveScore(mk(ID("b"), "2026-01-01T00:00:00.000Z"));
    await flush();
    expect(await m.flushPendingChanges()).toEqual({ pending: 1, unsyncable: 1 });
  });

  it("병합 후 dirty 재정의: 클라우드가 이긴 항목은 dirty 에서 빠진다", async () => {
    const m = await load();
    remote.saveScore.mockResolvedValue({ ok: false, error: "failed" });
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await flush();
    expect(m.getDirtyCount()).toBe(1);
    const newer = new Date(Date.now() + 3_600_000).toISOString();
    remote.listScores.mockResolvedValue(list("A", [mk(ID("a"), newer, "cloud")]));
    await m.syncFromCloud();
    expect(m.getDirtyCount()).toBe(0);
  });

  it("MAX_RERUNS 상한: 계속 mismatch 여도 3회까지만 실행", async () => {
    const m = await load();
    localStorage.setItem("humscore.scores.v1", JSON.stringify([mk(ID("a"), "2026-02-01T00:00:00.000Z")]));
    remote.listScores.mockResolvedValue(list("A"));
    remote.saveScore.mockResolvedValue({ ok: false, error: "mismatch" });
    await m.syncFromCloud();
    expect(remote.listScores).toHaveBeenCalledTimes(3);
  });

  it("5초 재동기화 타이머는 중복 예약되지 않는다", async () => {
    vi.useFakeTimers();
    const m = await load();
    remote.saveScore.mockResolvedValue({ ok: false, error: "stale" });
    remote.listScores.mockResolvedValue(list("A"));
    await m.saveScore(mk(ID("a"), "2026-01-01T00:00:00.000Z"));
    await m.saveScore(mk(ID("b"), "2026-01-01T00:00:00.000Z"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
  });
});
