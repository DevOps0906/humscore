import { beforeEach, describe, expect, it, vi } from "vitest";

let cookieUser = "A";
let upsertRows: { id: string }[] = [{ id: "x" }];
const updateSpy = vi.fn();

vi.mock("@/lib/storage/supabase/server", () => ({
  createSupabaseServer: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: cookieUser } }, error: null }) },
    from: () => ({
      upsert: () => ({ select: async () => ({ data: upsertRows, error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { updated_at: "2026-01-01T00:00:00.000Z" }, error: null }) }) }),
      update: (v: unknown) => {
        updateSpy(v);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
  }),
}));

import { deleteScore, saveScore } from "./scores";

const score = {
  id: "11111111-1111-4111-8111-111111111111", title: "t", bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
};

beforeEach(() => {
  cookieUser = "A";
  upsertRows = [{ id: "x" }];
  updateSpy.mockReset();
});

describe("scores 서버 액션", () => {
  it("saveScore: 쿠키 계정이 expectedUserId 와 다르면 mismatch", async () => {
    cookieUser = "B";
    expect(await saveScore(score, "A")).toEqual({ ok: false, error: "mismatch" });
  });
  it("saveScore: 같은 계정이면 ok", async () => {
    expect((await saveScore(score, "A")).ok).toBe(true);
  });
  it("saveScore: 반환 행이 없으면(LWW 로 건너뜀) stale", async () => {
    upsertRows = [];
    expect(await saveScore(score, "A")).toEqual({ ok: false, error: "stale" });
  });
  it("deleteScore: 계정이 다르면 mismatch 이고 update 하지 않는다", async () => {
    cookieUser = "B";
    expect(await deleteScore(score.id, "A")).toEqual({ ok: false, error: "mismatch" });
    expect(updateSpy).not.toHaveBeenCalled();
  });
  it("deleteScore: 같은 계정이면 ok", async () => {
    expect((await deleteScore(score.id, "A")).ok).toBe(true);
  });
});
