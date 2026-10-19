import { describe, expect, it } from "vitest";
import { scoreToMusicXML } from "../musicxml";
import { tempoTerm } from "../theory";
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
    expect(scoreToMusicXML(makeScore([]), "lead", { minMeasures: 9, measuresPerSystem: 0 })).not.toContain("<print");
  });
});

describe("scoreToMusicXML", () => {
  it("빈 notes 도 1마디 생성, 유효한 헤더", () => {
    const xml = scoreToMusicXML(makeScore([]));
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(count(xml, /<measure /g)).toBe(1);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain(">Melody</part-name>");
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
    const xml = scoreToMusicXML(makeScore([n(null, 0, 2), n(60, 2, 2)]));
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
  it("피아노: 한 음가로 안 되는 박자(6/4)는 왼손 코드를 온음표+2분음표 붙임줄로", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { beatsPerMeasure: 6, chords: [{ startBeat: 0, symbol: "C" }] }), "piano");
    expect(count(xml, /<staff>2<\/staff>/g)).toBe(6); // 3화음 × 2조각
    // 왼손 3화음 x 1 + 오른손 4박(6/4에서 온음표 불가 -> 점2분+4분 붙임줄) 1
    expect(count(xml, /<tie type="start"\/>/g)).toBe(4);
    expect(count(xml, /<tie type="stop"\/>/g)).toBe(4);
    expect(xml).not.toContain("undefined");
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
  it("샵 조는 샵 철자 (G장조의 A#은 위로 진행하면 A#)", () => {
    const xml = scoreToMusicXML(makeScore([n(70, 0, 2), n(71, 2, 2)], { key: { tonic: 7, mode: "major", fifths: 1 } }));
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
      expect(count(xml, /<rest\/>/g)).toBe(2); // 3박 쉼표 = 4분 + 2분 (점2분쉼표 안 씀)
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

describe("악보 요소 (줄바꿈·끝마디선·헤더·빠르기말)", () => {
  const wellFormed = (xml: string) => {
    const body = xml.replace(/<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>]*>/, "");
    const stack: string[] = [];
    for (const m of body.matchAll(/<(\/?)([A-Za-z][\w-]*)[^>]*?(\/?)>/g)) {
      if (m[3]) continue;
      if (m[1]) expect(stack.pop()).toBe(m[2]);
      else stack.push(m[2]);
    }
    expect(stack).toHaveLength(0);
  };

  for (const layout of ["lead", "piano"] as const) {
    it(`${layout}: 13마디 → 5·9·13마디에만 줄바꿈, 마지막 마디에만 끝마디선`, () => {
      const xml = scoreToMusicXML(makeScore([n(60, 48, 1)]), layout);
      expect(count(xml, /<measure /g)).toBe(13);
      expect(count(xml, /<print new-system="yes"\/>/g)).toBe(3);
      for (const k of [5, 9, 13]) expect(xml).toContain(`<measure number="${k}"><print new-system="yes"/>`);
      expect(xml).not.toContain(`<measure number="1"><print`);
      expect(count(xml, /<bar-style>light-heavy<\/bar-style>/g)).toBe(1);
      const last = xml.split("<measure ").pop()!;
      expect(last).toContain("<barline location=\"right\"><bar-style>light-heavy</bar-style></barline></measure>");
      wellFormed(xml);
    });
  }

  it("composer: 있으면 creator(이스케이프), 없거나 공백이면 없음", () => {
    const withC = scoreToMusicXML(makeScore([], { composer: "A & B" }));
    expect(withC).toContain('<creator type="composer">A &amp; B</creator>');
    wellFormed(withC);
    expect(scoreToMusicXML(makeScore([]))).not.toContain("<creator");
    expect(scoreToMusicXML(makeScore([], { composer: "  " }))).not.toContain("<creator");
  });

  it("빠르기말 경계", () => {
    const cases: [number, string][] = [[59, "Largo"], [60, "Larghetto"], [65, "Larghetto"], [66, "Adagio"], [75, "Adagio"], [76, "Andante"], [107, "Andante"], [108, "Moderato"], [119, "Moderato"], [120, "Allegro"], [155, "Allegro"], [156, "Vivace"], [175, "Vivace"], [176, "Presto"]];
    for (const [bpm, w] of cases) expect(tempoTerm(bpm)).toBe(w);
  });

  it("방향 요소: 빠르기말 + 메트로놈", () => {
    const xml = scoreToMusicXML(makeScore([], { bpm: 90 }));
    expect(xml).toContain("<words>Andante</words></direction-type><direction-type><metronome>");
  });

  it("파트 라벨: 리드시트는 숨김, 피아노는 표시", () => {
    expect(scoreToMusicXML(makeScore([]), "lead")).toContain('<part-name print-object="no">Melody</part-name>');
    const piano = scoreToMusicXML(makeScore([]), "piano");
    expect(piano).toContain("<part-name>Piano</part-name>");
    expect(piano).not.toContain("print-object");
  });
});
