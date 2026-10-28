import { describe, expect, it } from "vitest";
import { applyLyrics, splitLyrics, syllabicOf } from "../lyrics";
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
});
