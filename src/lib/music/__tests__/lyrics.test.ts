import { describe, expect, it } from "vitest";
import { applyLyrics, lyricForVerse, setLyricForVerse, splitLyrics, syllabicOf } from "../lyrics";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";
import type { NoteEvent } from "../types";

const n = (midi: number | null, startBeat: number, durationBeats = 1, lyric?: string): NoteEvent =>
  lyric === undefined ? { midi, startBeat, durationBeats } : { midi, startBeat, durationBeats, lyric };

describe("splitLyrics", () => {
  it("한글은 글자 단위, 공백·문장부호 제거", () => {
    expect(splitLyrics("  반짝, 반짝!  작은 별.", "ko")).toEqual(["반", "짝", "반", "짝", "작", "은", "별"]);
  });
  it("라틴은 단어 단위, 하이픈은 음절 분리", () => {
    expect(splitLyrics("Hap-py birth-day, to you!", "auto")).toEqual(["Hap-", "py", "birth-", "day", "to", "you"]);
  });
  it("아포스트로피 유지·빈 하이픈 무시", () => {
    expect(splitLyrics("don't -- go-", "latin")).toEqual(["don't", "go"]);
  });
});

describe("applyLyrics", () => {
  it("쉼표를 건너뛰고 순서대로 배정, 남는 음절은 rest", () => {
    const notes = [n(60, 0), n(null, 1), n(62, 2), n(64, 3)];
    const r = applyLyrics(notes, ["a", "b", "c", "d"]);
    expect(r.notes.map((x) => x.lyric)).toEqual(["a", undefined, "b", "c"]);
    expect(r.rest).toEqual(["d"]);
    expect(notes[0].lyric).toBeUndefined(); // 원본 불변
  });
  it("fromIndex 부터 배정", () => {
    const r = applyLyrics([n(60, 0, 1, "x"), n(62, 1), n(64, 2)], ["가", "나"], 1);
    expect(r.notes.map((x) => x.lyric)).toEqual(["x", "가", "나"]);
    expect(r.rest).toEqual([]);
  });
  it("2절 적용은 기존 1절·다른 절을 보존하며 쉼표를 건너뛴다", () => {
    const notes = [{ ...n(60, 0, 1, "옛"), lyrics: { "3": "셋" } }, n(null, 1), n(62, 2, 1, "말")];
    const before = structuredClone(notes);
    const r = applyLyrics(notes, ["새", "글", "남"], 0, 2);
    expect(r.notes.map((note) => lyricForVerse(note, 1))).toEqual(["옛", undefined, "말"]);
    expect(r.notes.map((note) => lyricForVerse(note, 2))).toEqual(["새", undefined, "글"]);
    expect(lyricForVerse(r.notes[0], 3)).toBe("셋");
    expect(r.rest).toEqual(["남"]);
    expect(notes).toEqual(before);
  });
  it("선택한 절만 지우고 1절은 구버전 필드와 동기화한다", () => {
    const first = setLyricForVerse(n(60, 0), "하", 1);
    const both = setLyricForVerse(first, "늘", 2);
    const withoutFirst = setLyricForVerse(both, undefined, 1);
    expect(first.lyric).toBe("하");
    expect(first.lyrics).toEqual({ "1": "하" });
    expect(withoutFirst.lyric).toBeUndefined();
    expect(withoutFirst.lyrics).toEqual({ "2": "늘" });
    expect(setLyricForVerse(withoutFirst, undefined, 2).lyrics).toBeUndefined();
    expect(both.lyrics).toEqual({ "1": "하", "2": "늘" });
  });
  it("99절까지 지원하고 잘못된 절 번호는 거부한다", () => {
    expect(lyricForVerse(setLyricForVerse(n(60, 0), "끝", 99), 99)).toBe("끝");
    for (const verse of [0, 100, 1.5, NaN]) expect(() => applyLyrics([], [], 0, verse)).toThrow(RangeError);
  });
});

describe("MusicXML lyric", () => {
  it("syllabic 결정", () => {
    expect(syllabicOf(undefined, "가")).toBe("single");
    expect(syllabicOf(undefined, "hap-")).toBe("begin");
    expect(syllabicOf("hap-", "pi-")).toBe("middle");
    expect(syllabicOf("pi-", "ness")).toBe("end");
  });
  it("한글 single, 하이픈 begin/end, 쉼표엔 없음", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 1, "가"), n(null, 1), n(62, 2, 1, "Hap-"), n(64, 3, 1, "py")]));
    expect(xml).toContain(`<lyric number="1"><syllabic>single</syllabic><text>가</text></lyric>`);
    expect(xml).toContain(`<lyric number="1"><syllabic>begin</syllabic><text>Hap</text></lyric>`);
    expect(xml).toContain(`<lyric number="1"><syllabic>end</syllabic><text>py</text></lyric>`);
    expect((xml.match(/<lyric /g) ?? []).length).toBe(3);
  });
  it("붙임줄로 나뉜 음은 첫 조각에만 가사", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 3, 2, "길")]));
    expect((xml.match(/<lyric /g) ?? []).length).toBe(1);
  });
  it("절별 가사를 중복 없이 나란히 출력하고 각 절의 음절 연결을 독립 계산한다", () => {
    const notes: NoteEvent[] = [
      { ...n(60, 0, 1, "옛"), lyrics: { "1": "hap-", "2": "둘" } },
      { ...n(62, 1), lyrics: { "1": "py", "2": "째-" } },
      { ...n(64, 2), lyrics: { "2": "절" } },
    ];
    const before = structuredClone(notes);
    const xml = scoreToMusicXML(makeScore(notes));
    expect(xml).toContain('<lyric number="1" name="1절"><syllabic>begin</syllabic><text>(1절) hap</text></lyric>');
    expect(xml).toContain('<lyric number="2" name="2절"><syllabic>single</syllabic><text>(2절) 둘</text></lyric>');
    expect(xml).toContain('<lyric number="1" name="1절"><syllabic>end</syllabic><text>py</text></lyric>');
    expect(xml).toContain('<lyric number="2" name="2절"><syllabic>begin</syllabic><text>째</text></lyric>');
    expect(xml.match(/<lyric /g)).toHaveLength(5);
    expect(xml).not.toContain("옛");
    expect(notes).toEqual(before);
  });
  it("여러 절도 붙임줄 첫 조각에만 출력하고 XML 문자를 이스케이프한다", () => {
    const xml = scoreToMusicXML(makeScore([{ ...n(60, 3, 2), lyrics: { "1": "<&", "12": "열둘" } }]));
    expect(xml.match(/<lyric /g)).toHaveLength(2);
    expect(xml).toContain("(1절) &lt;&amp;");
    expect(xml).toContain('number="12" name="12절"');
  });
});
