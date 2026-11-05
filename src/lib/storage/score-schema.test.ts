import { describe, expect, it } from "vitest";
import type { Score } from "../music/types";
import { MAX_SCORE_BYTES, parseScore, scoreBytes, scoreSchema } from "./score-schema";

const base = (): Score => ({
  id: "3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c", title: "가".repeat(200), bpm: 90, beatsPerMeasure: 4, beatUnit: 4,
  key: { tonic: 0, mode: "major", fifths: 0 }, notes: [], chords: [], transpose: 0,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("score-schema", () => {
  it("반주 설정을 보존하고 잘못된 모드와 패턴을 거부한다", () => {
    const s: Score = { ...base(), accompaniment: { mode: "arpeggio", pattern: "alberti" } };
    expect(parseScore(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseScore({ ...base(), accompaniment: { mode: "block", pattern: "ascending" } })).not.toBeNull();
    expect(parseScore({ ...base(), accompaniment: { mode: "invalid", pattern: "ascending" } })).toBeNull();
    expect(parseScore({ ...base(), accompaniment: { mode: "arpeggio", pattern: "invalid" } })).toBeNull();
  });
  it("생성 방식·음색과 드럼 동시 타격은 JSON 저장·서버 검증 후에도 보존된다", () => {
    const score: Score = { ...base(), notation: "drums", instrument: "drumKit", notes: [
      { midi: 36, startBeat: 0, durationBeats: 0.5 },
      { midi: 42, startBeat: 0, durationBeats: 0.5 },
    ] };
    expect(parseScore(JSON.parse(JSON.stringify(score)))).toEqual(score);
    expect(parseScore({ ...base(), notation: "guitarTab", instrument: "bassGuitar5", notes: [{ midi: 23, startBeat: 0, durationBeats: 1 }] })?.instrument).toBe("bassGuitar5");
  });
  it("새 음색은 검증하고 기존 악보에는 생성 방식과 음색을 강제로 붙이지 않는다", () => {
    expect(parseScore({ ...base(), instrument: "epRhodes", notation: "piano" })?.instrument).toBe("epRhodes");
    expect(parseScore({ ...base(), instrument: "없는 음색" })).toBeNull();
    expect(parseScore({ ...base(), notation: "알 수 없는 방식" })).toBeNull();
    expect(parseScore(base())).toEqual(base());
  });
  it("절별 가사 1~99와 기존 1절은 서버 검증 후에도 보존된다", () => {
    const s = { ...base(), notes: [{ midi: 60, startBeat: 0, durationBeats: 1, lyric: "가", lyrics: { "1": "가", "2": "나", "99": "다" } }] };
    expect(parseScore(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it.each(["0", "100", "01", "1.5"])("잘못된 가사 절 번호 %s는 거부한다", (verse) => {
    expect(parseScore({ ...base(), notes: [{ midi: 60, startBeat: 0, durationBeats: 1, lyrics: { [verse]: "가" } }] })).toBeNull();
  });
  it("절별 가사도 40자 상한과 빈 문자열 금지를 따른다", () => {
    for (const text of ["", "가".repeat(41)]) {
      expect(parseScore({ ...base(), notes: [{ midi: 60, startBeat: 0, durationBeats: 1, lyrics: { "2": text } }] })).toBeNull();
    }
  });
  it("정상 Score 통과, ISO 가 아닌 날짜는 거부", () => {
    expect(parseScore(base())).not.toBeNull();
    expect(parseScore({ ...base(), updatedAt: "Jan 1 2026" })).toBeNull();
    expect(parseScore({ ...base(), updatedAt: "2026-01-01" })).toBeNull();
  });
  it("최대 크기 Score 도 Server Action 한도(1MB)보다 충분히 작다", () => {
    const long = 29999.999999999996; // 최악에 가까운 자릿수
    const max: Score = {
      ...base(),
      notes: Array.from({ length: 6_000 }, () => ({ midi: 108, startBeat: long, durationBeats: long })),
      chords: Array.from({ length: 1_500 }, () => ({ startBeat: long, symbol: "F#m7b5/C#" })),
    };
    expect(scoreSchema.safeParse(max).success).toBe(true);
    expect(scoreBytes(max)).toBeLessThan(MAX_SCORE_BYTES);
  });
  it("새 필드(작사·편곡·머리글·박자표)는 저장 후에도 그대로 남는다", () => {
    const s: Score = { ...base(), lyricist: "작사가", composer: "작곡가", arranger: "편곡가", headerFont: "nanum-myeongjo", headerFontSize: 18, meter: "3/4", beatsPerMeasure: 3 };
    expect(parseScore(s)).toEqual(s);
  });
  it("meter 6/8 은 beatsPerMeasure 3 일 때만 허용 (박자표와 마디 길이 불일치 방지)", () => {
    expect(parseScore({ ...base(), meter: "6/8", beatsPerMeasure: 3 })).not.toBeNull();
    expect(parseScore({ ...base(), meter: "6/8", beatsPerMeasure: 4 })).toBeNull();
    expect(parseScore({ ...base(), meter: "4/4", beatsPerMeasure: 4 })).not.toBeNull();
  });
  it("머리글 글자 크기·박자표 값 범위 밖은 거부", () => {
    expect(parseScore({ ...base(), headerFontSize: 9 })).toBeNull();
    expect(parseScore({ ...base(), headerFontSize: 49 })).toBeNull();
    expect(parseScore({ ...base(), meter: "5/4" })).toBeNull();
  });
  it("상한 초과는 거부", () => {
    const over = { ...base(), notes: Array.from({ length: 6_001 }, () => ({ midi: 60, startBeat: 0, durationBeats: 1 })) };
    expect(scoreSchema.safeParse(over).success).toBe(false);
  });
  it("dynamics·marks 는 통과하고 저장 후에도 보존된다", () => {
    const s: Score = {
      ...base(),
      dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 4, kind: "cresc", durationBeats: 4 }],
      marks: [{ measure: 0, kind: "repeatStart" }, { measure: 3, kind: "dcAlFine" }],
    };
    expect(parseScore(s)).toEqual(s);
    expect(parseScore({ ...base(), dynamics: [], marks: [] })).not.toBeNull();
  });
  it("dynamics·marks 잘못된 값은 거부", () => {
    expect(parseScore({ ...base(), dynamics: [{ startBeat: 0, kind: "fff" }] })).toBeNull();
    expect(parseScore({ ...base(), dynamics: [{ startBeat: -1, kind: "p" }] })).toBeNull();
    expect(parseScore({ ...base(), dynamics: [{ startBeat: 0, kind: "cresc", durationBeats: 0 }] })).toBeNull();
    expect(parseScore({ ...base(), dynamics: Array.from({ length: 2001 }, () => ({ startBeat: 0, kind: "p" })) })).toBeNull();
    expect(parseScore({ ...base(), marks: [{ measure: -1, kind: "coda" }] })).toBeNull();
    expect(parseScore({ ...base(), marks: [{ measure: 1.5, kind: "coda" }] })).toBeNull();
    expect(parseScore({ ...base(), marks: [{ measure: 10001, kind: "coda" }] })).toBeNull();
    expect(parseScore({ ...base(), marks: [{ measure: 0, kind: "bogus" }] })).toBeNull();
    expect(parseScore({ ...base(), marks: Array.from({ length: 501 }, () => ({ measure: 0, kind: "coda" })) })).toBeNull();
  });
  it("음표 가사는 저장 후에도 그대로 남고, 빈 문자열·40자 초과는 거부", () => {
    const s: Score = { ...base(), notes: [
      { midi: 60, startBeat: 0, durationBeats: 1, lyric: "반-" },
      { midi: 62, startBeat: 1, durationBeats: 1, lyric: "짝" },
      { midi: null, startBeat: 2, durationBeats: 1 },
    ] };
    expect(parseScore(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const one = (lyric: string) => ({ ...base(), notes: [{ midi: 60, startBeat: 0, durationBeats: 1, lyric }] });
    expect(parseScore(one("가".repeat(40)))).not.toBeNull();
    expect(parseScore(one("가".repeat(41)))).toBeNull();
    expect(parseScore(one(""))).toBeNull();
  });
});
