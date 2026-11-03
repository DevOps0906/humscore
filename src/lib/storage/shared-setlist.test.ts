import { describe, expect, it } from "vitest";
import { parseSharedSetlist } from "./shared-setlist";

const SCORE_ID = "11111111-1111-4111-8111-111111111111";
const ITEM = { scoreId: SCORE_ID, transpose: 2, bpm: null, form: "A-B", note: null, transition: null };
const SCORE = {
  id: SCORE_ID,
  title: "찬양",
  bpm: 100,
  beatsPerMeasure: 4,
  beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 },
  notes: [{ midi: 60, startBeat: 0, durationBeats: 1 }],
  chords: [],
  transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("parseSharedSetlist", () => {
  it("검증된 RPC 결과를 앱 형태로 바꾸고 생략된 비공개 메모를 비운다", () => {
    expect(parseSharedSetlist({
      title: "주일 1부",
      service_date: "2026-11-08",
      memo: null,
      items: [{ scoreId: SCORE_ID, transpose: 2, bpm: null, form: "A-B" }],
      scores: [{ id: SCORE_ID, title: "찬양", data: SCORE }],
    })).toEqual({
      title: "주일 1부",
      serviceDate: "2026-11-08",
      memo: null,
      items: [ITEM],
      scores: [SCORE],
    });
  });

  it("필수 필드가 없거나 항목이 잘못되면 거부한다", () => {
    expect(parseSharedSetlist({ title: "주일", service_date: "2026-11-08", memo: null, items: [], scores: [] })).not.toBeNull();
    expect(parseSharedSetlist({ title: "주일", service_date: "2026-11-08", memo: null, items: [{ ...ITEM, extra: true }], scores: [] })).toBeNull();
    expect(parseSharedSetlist({ title: "주일", service_date: "2026-11-08", memo: null, items: [ITEM], scores: [{ id: SCORE_ID, title: "찬양", data: { ...SCORE, id: "22222222-2222-4222-8222-222222222222" } }] })).toBeNull();
  });
});
