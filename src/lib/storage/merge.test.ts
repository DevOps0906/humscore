import { describe, expect, it } from "vitest";
import type { Score } from "../music/types";
import { mergeScores, ts } from "./merge";

const mk = (id: string, updatedAt: string, title = id): Score => ({
  id, title, bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt,
});
const tomb = (id: string, at: string) => ({ id, updatedAt: at, deletedAt: at });

describe("mergeScores", () => {
  it("클라우드에만 있는 악보는 로컬로 가져온다", () => {
    const r = mergeScores({ local: [], cloud: [mk("a", "2026-02-01T00:00:00Z")] });
    expect(r.merged.map((s) => s.id)).toEqual(["a"]);
    expect(r.toPush).toEqual([]);
  });
  it("로컬에만 있는 악보는 올린다", () => {
    const r = mergeScores({ local: [mk("a", "2026-02-01T00:00:00Z")], cloud: [] });
    expect(r.toPush.map((s) => s.id)).toEqual(["a"]);
  });
  it("updatedAt 이 더 최신인 쪽이 이긴다", () => {
    const l = mk("a", "2026-03-01T00:00:00Z", "local");
    const c = mk("a", "2026-02-01T00:00:00Z", "cloud");
    const r1 = mergeScores({ local: [l], cloud: [c] });
    expect(r1.merged[0].title).toBe("local");
    expect(r1.toPush).toHaveLength(1);
    const r2 = mergeScores({ local: [c], cloud: [l] });
    expect(r2.merged[0].title).toBe("local");
    expect(r2.toPush).toEqual([]);
  });
  it("동률이면 로컬 유지, 재전송 안 함", () => {
    const r = mergeScores({ local: [mk("a", "2026-02-01T00:00:00Z", "L")], cloud: [mk("a", "2026-02-01T00:00:00Z", "C")] });
    expect(r.merged[0].title).toBe("L");
    expect(r.toPush).toEqual([]);
  });
  it("문자열 비교가 아니라 Date.parse 로 비교한다 (오프셋 표기 차이)", () => {
    // 문자열로는 "…T10:00:00+09:00" > "…T05:00:00.000Z" 이지만 실제로는 +09:00 쪽이 4시간 이르다
    const a = mk("a", "2026-02-01T10:00:00+09:00", "early");
    const b = mk("a", "2026-02-01T05:00:00.000Z", "late");
    expect(ts(a.updatedAt)).toBeLessThan(ts(b.updatedAt));
    expect(mergeScores({ local: [a], cloud: [b] }).merged[0].title).toBe("late");
  });
  it("로컬 삭제 기록: 클라우드 사본을 되살리지 않고 삭제를 전파한다", () => {
    const r = mergeScores({ local: [], cloud: [mk("a", "2026-02-01T00:00:00Z")], localTombstones: { a: "2026-02-02T00:00:00Z" } });
    expect(r.merged).toEqual([]);
    expect(r.toDelete).toEqual(["a"]);
  });
  it("삭제 이후에 수정된 로컬 악보는 살아남고 삭제 기록은 정리된다", () => {
    const r = mergeScores({ local: [mk("a", "2026-03-01T00:00:00Z")], cloud: [], localTombstones: { a: "2026-02-02T00:00:00Z" } });
    expect(r.merged).toHaveLength(1);
    expect(r.toDelete).toEqual([]);
    expect(r.clearTombstones).toEqual(["a"]);
  });
  it("원격 삭제 기록이 로컬보다 새로우면 로컬에서도 지운다", () => {
    const r = mergeScores({ local: [mk("a", "2026-02-01T00:00:00Z")], cloud: [], cloudTombstones: [tomb("a", "2026-02-05T00:00:00Z")] });
    expect(r.merged).toEqual([]);
    expect(r.toPush).toEqual([]);
  });
  it("원격 삭제 이후 로컬에서 더 늦게 수정했으면 다시 올린다(되살림)", () => {
    const r = mergeScores({ local: [mk("a", "2026-03-01T00:00:00Z")], cloud: [], cloudTombstones: [tomb("a", "2026-02-05T00:00:00Z")] });
    expect(r.merged.map((s) => s.id)).toEqual(["a"]);
    expect(r.toPush.map((s) => s.id)).toEqual(["a"]);
  });
  it("로컬·원격 모두 삭제 기록이면 로컬 기록만 정리한다", () => {
    const r = mergeScores({ local: [], cloud: [], localTombstones: { a: "2026-02-02T00:00:00Z" }, cloudTombstones: [tomb("a", "2026-02-03T00:00:00Z")] });
    expect(r.toDelete).toEqual([]);
    expect(r.clearTombstones).toEqual(["a"]);
  });
  it("최신순 정렬", () => {
    const r = mergeScores({ local: [mk("a", "2026-01-01T00:00:00Z")], cloud: [mk("b", "2026-02-01T00:00:00Z")] });
    expect(r.merged.map((s) => s.id)).toEqual(["b", "a"]);
  });
  it("소유자 전환: 다른 계정 로컬 데이터를 비운 뒤(빈 local) 병합하면 업로드 대상이 없다", () => {
    // scores.ts 가 소유자 불일치 시 clearAccountData() 후 병합한다
    const r = mergeScores({ local: [], cloud: [mk("mine", "2026-02-01T00:00:00Z")] });
    expect(r.toPush).toEqual([]);
    expect(r.merged.map((s) => s.id)).toEqual(["mine"]);
  });
});
