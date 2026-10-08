import { describe, expect, it } from "vitest";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";
import type { NoteEvent } from "../types";

const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("scoreToMusicXML 옵션", () => {
  it("minMeasures 8 → 마디 8개, 빈 마디는 온쉼표", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 1)]), "lead", { minMeasures: 8 });
    expect(count(xml, /<measure /g)).toBe(8);
    expect(count(xml, /<rest measure="yes"\/>/g)).toBe(7);
  });
  it("piano 레이아웃도 빈 마디 정상", () => {
    const xml = scoreToMusicXML(makeScore([]), "piano", { minMeasures: 3 });
    expect(count(xml, /<measure /g)).toBe(3);
    expect(count(xml, /<backup>/g)).toBe(3);
  });
  it("음표가 9마디면 minMeasures 8 이어도 9마디", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 32, 1)]), "lead", { minMeasures: 8 });
    expect(count(xml, /<measure /g)).toBe(9);
  });
  it("measuresPerSystem 4 → 마디 5, 9에서만 print", () => {
    const xml = scoreToMusicXML(makeScore([]), "lead", { minMeasures: 9, measuresPerSystem: 4 });
    expect(count(xml, /<print new-system="yes"\/>/g)).toBe(2);
    expect(xml).toContain(`<measure number="5"><print new-system="yes"/>`);
    expect(xml).toContain(`<measure number="9"><print new-system="yes"/>`);
    expect(scoreToMusicXML(makeScore([]), "lead", { minMeasures: 9 })).not.toContain("<print");
  });
});

describe("scoreToMusicXML", () => {
  it("빈 notes 도 1마디 생성, 유효한 헤더", () => {
    const xml = scoreToMusicXML(makeScore([]));
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(count(xml, /<measure /g)).toBe(1);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<part-name>Melody</part-name>");
  });
  it("제목 XML 이스케이프", () => {
    const xml = scoreToMusicXML(makeScore([], { title: "A & B <c>" }));
    expect(xml).toContain("A &amp; B &lt;c&gt;");
  });
  it("템포/박자 출력", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 3)], { bpm: 90, beatsPerMeasure: 3 }));
    expect(xml).toContain("<per-minute>90</per-minute>");
    expect(xml).toContain("<beats>3</beats>");
  });
  it("쉼표는 <rest/>, 음은 <pitch>", () => {
    const xml = scoreToMusicXML(makeScore([n(null, 0, 1), n(60, 1, 3)]));
    expect(count(xml, /<rest\/>/g)).toBe(1);
    expect(count(xml, /<pitch>/g)).toBe(1);
    expect(xml).not.toContain("<tie ");
  });
  it("쉼표는 마디를 넘어도 tie 없음", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 1), n(null, 1, 6), n(60, 7, 1)]));
    expect(xml).not.toContain("<tie ");
    expect(count(xml, /<measure /g)).toBe(2);
  });
  it("마디 경계를 넘는 음: 정확히 tie start 1 + stop 1, 마디별 duration 합 = 16", () => {
    const xml = scoreToMusicXML(makeScore([n(null, 0, 3), n(64, 3, 3), n(62, 6, 2)]));
    expect(count(xml, /<tie type="start"\/>/g)).toBe(1);
    expect(count(xml, /<tie type="stop"\/>/g)).toBe(1);
    const measures = xml.split("<measure ").slice(1);
    expect(measures).toHaveLength(2);
    for (const m of measures) {
      const total = [...m.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((s, x) => s + Number(x[1]), 0);
      expect(total).toBe(16);
    }
  });
  it("마디 3개에 걸친 음: 가운데 조각은 start+stop 둘 다", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 10), n(null, 10, 2)]));
    expect(count(xml, /<tie type="start"\/>/g)).toBe(2);
    expect(count(xml, /<tie type="stop"\/>/g)).toBe(2);
  });
  it("5박 같은 표기 불가 길이는 분해 + tie", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 1.25), n(null, 1.25, 2.75)]));
    expect(count(xml, /<tie type="start"\/>/g)).toBe(1);
    expect(xml).toContain("<type>16th</type>");
  });
  it("점음표 표기 (1.5박 = 점4분)", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 1.5), n(62, 1.5, 0.5), n(null, 2, 2)]));
    expect(xml).toContain("<dot/>");
  });
  it("온음표 (4박)", () => {
    expect(scoreToMusicXML(makeScore([n(60, 0, 4)]))).toContain("<type>whole</type>");
  });
  it("리드시트: staves/chord 없음, 코드 harmony 출력", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { chords: [{ startBeat: 0, symbol: "Am7" }] }), "lead");
    expect(xml).not.toContain("<staves>");
    expect(xml).not.toContain("<chord/>");
    expect(xml).toContain("<root-step>A</root-step>");
    expect(xml).toContain("minor-seventh");
  });
  it("코드 #/b 근음 alter", () => {
    const sharp = scoreToMusicXML(makeScore([n(60, 0, 4)], { chords: [{ startBeat: 0, symbol: "F#m" }] }));
    expect(sharp).toContain("<root-alter>1</root-alter>");
    const flat = scoreToMusicXML(makeScore([n(60, 0, 4)], { key: { tonic: 5, mode: "major", fifths: -1 }, chords: [{ startBeat: 0, symbol: "Bb" }] }));
    expect(flat).toContain("<root-alter>-1</root-alter>");
  });
  it("transpose 0 이면 코드 기호 철자 보존 (C장조에서 Bb 유지)", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { chords: [{ startBeat: 0, symbol: "Bb" }] }));
    expect(xml).toContain("<root-alter>-1</root-alter>");
  });
  it("피아노: 대보표, 마디당 왼손 3화음 + backup", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4), n(62, 4, 4)], { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }] }), "piano");
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain("<part-name>Piano</part-name>");
    expect(count(xml, /<backup>/g)).toBe(2);
    expect(count(xml, /<chord\/>/g)).toBe(4); // 마디당 2개 (3화음 중 2번째·3번째)
    expect(count(xml, /<staff>2<\/staff>/g)).toBe(6);
  });
  it("피아노: 코드 없으면 마디 쉼표", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)]), "piano");
    expect(xml).toContain('<rest measure="yes"/>');
  });
  it("낮은 음역은 옥타브 낮춘 높은음자리표", () => {
    const low = scoreToMusicXML(makeScore([n(48, 0, 4)]));
    expect(low).toContain("<clef-octave-change>-1</clef-octave-change>");
    const high = scoreToMusicXML(makeScore([n(67, 0, 4)]));
    expect(high).not.toContain("clef-octave-change");
  });
  it("조표/모드 출력, 플랫 조는 플랫 철자", () => {
    const xml = scoreToMusicXML(makeScore([n(70, 0, 4)], { key: { tonic: 5, mode: "major", fifths: -1 } }));
    expect(xml).toContain("<fifths>-1</fifths>");
    expect(xml).toContain("<mode>major</mode>");
    expect(xml).toContain("<step>B</step><alter>-1</alter>");
  });
  it("샵 조는 샵 철자", () => {
    const xml = scoreToMusicXML(makeScore([n(70, 0, 4)]));
    expect(xml).toContain("<step>A</step><alter>1</alter>");
  });

  describe("transpose", () => {
    it("transpose 적용: 음·조표·코드 이동", () => {
      const s = makeScore([n(60, 0, 4)], { transpose: 7, chords: [{ startBeat: 0, symbol: "C" }] });
      const xml = scoreToMusicXML(s);
      expect(xml).toContain("<step>G</step><octave>4</octave>");
      expect(xml).toContain("<fifths>1</fifths>");
      expect(xml).toContain("<root-step>G</root-step>");
    });
    it("원본 Score 불변 (deep equal)", () => {
      const s = makeScore([n(60, 0, 3), n(null, 3, 1), n(62, 4, 4)], { transpose: -5, chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G/B" }] });
      const before = JSON.parse(JSON.stringify(s));
      scoreToMusicXML(s, "lead");
      scoreToMusicXML(s, "piano");
      expect(s).toEqual(before);
    });
    it("transpose 0 와 ±12 는 같은 조표, 옥타브만 다름", () => {
      const base = scoreToMusicXML(makeScore([n(60, 0, 4)]));
      const up = scoreToMusicXML(makeScore([n(60, 0, 4)], { transpose: 12 }));
      expect(up).toContain("<fifths>0</fifths>");
      expect(up).toContain("<step>C</step><octave>5</octave>");
      expect(base).toContain("<step>C</step><octave>4</octave>");
    });
    it("전조로 음역이 내려가면 clef 변경 (C4 -12 -> C3)", () => {
      const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { transpose: -12 }));
      expect(xml).toContain("clef-octave-change");
    });
  });

  describe("미완성 마디 / 빈 마디", () => {
    const total = (m: string) => [...m.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((s, x) => s + Number(x[1]), 0);
    it("빈 notes: 온쉼표", () => {
      expect(scoreToMusicXML(makeScore([]))).toContain('<rest measure="yes"/>');
    });
    it("마지막 마디 덜 차면 쉼표로 채움", () => {
      const xml = scoreToMusicXML(makeScore([n(60, 0, 4), n(62, 4, 1)]));
      const ms = xml.split("<measure ").slice(1);
      expect(ms).toHaveLength(2);
      for (const m of ms) expect(total(m)).toBe(16);
      expect(count(xml, /<rest\/>/g)).toBe(1);
    });
    it("코드가 있는 뒤쪽 마디도 출력 (쉼표 채움)", () => {
      const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { chords: [{ startBeat: 8, symbol: "G" }] }));
      const ms = xml.split("<measure ").slice(1);
      expect(ms).toHaveLength(3);
      for (const m of ms) expect(total(m)).toBe(16);
      expect(ms[2]).toContain("<root-step>G</root-step>");
    });
  });
});
