import { describe, expect, it } from "vitest";
import { scoreToMusicXML } from "../musicxml";
import { measureOrder } from "../form";
import { tempoTerm } from "../theory";
import { makeScore } from "./helpers";
import type { MeasureMarkKind, NoteEvent } from "../types";

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
    expect(count(xml, /<measure /g)).toBe(6); // 멜로디 3 + 피아노 3
    expect(count(xml, /<backup>/g)).toBe(0);
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
  it("피아노: 두 파트(Melody/Piano) + brace part-group, 마디당 왼손 3화음", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4), n(62, 4, 4)], { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }] }), "piano");
    expect(xml).not.toContain("<staves>");
    expect(xml).toContain("<part-name>Melody</part-name>");
    expect(xml).toContain("<part-name>Piano</part-name>");
    expect(xml).toContain('<part-group type="start" number="1"><group-symbol>brace</group-symbol><group-barline>yes</group-barline></part-group>');
    expect(xml).toContain('<part-group type="stop" number="1"/>');
    expect(count(xml, /<score-part /g)).toBe(2);
    expect(count(xml, /<part id=/g)).toBe(2);
    const [mel, low] = xml.split('<part id="P2">');
    expect(mel).toContain("<sign>G</sign>");
    expect(low).toContain("<sign>F</sign>");
    expect(low).not.toContain("<sign>G</sign>");
    expect(count(xml, /<backup>/g)).toBe(0);
    expect(count(low, /<chord\/>/g)).toBe(4); // 마디당 2개 (3화음 중 2번째·3번째)
    expect(count(low, /<note>/g)).toBe(6);
  });
  it("피아노: 한 음가로 안 되는 박자(6/4)는 왼손 코드를 온음표+2분음표 붙임줄로", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { beatsPerMeasure: 6, chords: [{ startBeat: 0, symbol: "C" }] }), "piano");
    expect(count(xml.split('<part id="P2">')[1], /<note>/g)).toBe(6); // 3화음 × 2조각
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
      const parts = layout === "piano" ? 2 : 1;
      expect(count(xml, /<measure /g)).toBe(13 * parts);
      expect(count(xml, /<print new-system="yes"\/>/g)).toBe(3 * parts);
      for (const k of [5, 9, 13]) expect(xml).toContain(`<measure number="${k}"><print new-system="yes"/>`);
      expect(xml).not.toContain(`<measure number="1"><print`);
      expect(count(xml, /<bar-style>light-heavy<\/bar-style>/g)).toBe(parts);
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
    expect(piano).toContain("<part-name>Melody</part-name>");
    expect(piano).not.toContain("print-object");
  });
});

describe("scoreToMusicXML 6/8 · 작사/편곡 · externalHeader", () => {
  const sc68 = (notes: NoteEvent[], over = {}) => makeScore(notes, { beatsPerMeasure: 3, meter: "6/8", ...over });
  it("6/8 은 <time> 6/8, 3/4 는 3/4", () => {
    expect(scoreToMusicXML(sc68([n(60, 0, 3)]))).toContain("<time><beats>6</beats><beat-type>8</beat-type></time>");
    expect(scoreToMusicXML(makeScore([n(60, 0, 3)], { beatsPerMeasure: 3 }))).toContain("<time><beats>3</beats><beat-type>4</beat-type></time>");
  });
  it("6/8 마디 길이 12 divisions, 마디 경계 넘는 음은 붙임줄로 분할", () => {
    const xml = scoreToMusicXML(sc68([n(60, 0, 1), n(62, 1, 3), n(64, 4, 2)]));
    expect(count(xml, /<measure /g)).toBe(2);
    const m1 = /<measure number="1">([\s\S]*?)<\/measure>/.exec(xml)![1];
    const durs = [...m1.matchAll(/<duration>(\d+)<\/duration>/g)].map((x) => Number(x[1]));
    expect(durs.reduce((a, b) => a + b, 0)).toBe(12);
    expect(count(xml, /<tie type="start"\/>/g)).toBe(count(xml, /<tie type="stop"\/>/g));
    expect(count(xml, /<tie type="start"\/>/g)).toBeGreaterThan(0);
  });
  it("작사·작곡·편곡 creator 출력 (esc, 빈 값 제외)", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { lyricist: "A&B", composer: "C", arranger: "  " }));
    expect(xml).toContain(`<creator type="lyricist">A&amp;B</creator>`);
    expect(xml).toContain(`<creator type="composer">C</creator>`);
    expect(xml).not.toContain(`type="arranger"`);
    expect(scoreToMusicXML(makeScore([n(60, 0, 4)], { arranger: "D" }))).toContain(`<creator type="arranger">D</creator>`);
  });
  it("externalHeader: 빠르기말·메트로놈·제목·creator 없음", () => {
    const sc = makeScore([n(60, 0, 4)], { lyricist: "L", composer: "C", arranger: "R", title: "제목" });
    const xml = scoreToMusicXML(sc, "lead", { externalHeader: true });
    expect(xml).not.toContain("<direction");
    expect(xml).not.toContain("<metronome");
    expect(xml).not.toContain("<work-title");
    expect(xml).not.toContain("<creator");
    expect(xml).toContain("<software>HumScore</software>");
    const normal = scoreToMusicXML(sc);
    expect(normal).toContain("<metronome>");
    expect(normal).toContain("<work-title>제목</work-title>");
    expect(scoreToMusicXML(sc, "lead", { externalHeader: false })).toBe(normal);
  });
});

describe("scoreToMusicXML 셈여림·마디 기호", () => {
  const notes4 = [n(60, 0, 4), n(62, 4, 4), n(64, 8, 4), n(65, 12, 4)];
  it("셈여림: dynamics 요소, 해당 박 음표 앞", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 8, kind: "ff" }] }));
    expect(xml).toContain("<dynamics><p/></dynamics>");
    expect(xml).toContain("<dynamics><ff/></dynamics>");
    const m3 = xml.split("<measure ")[3];
    expect(m3.indexOf("<ff/>")).toBeLessThan(m3.indexOf("<note>"));
    const m1 = xml.split("<measure ")[1];
    expect(m1.indexOf("<p/>")).toBeLessThan(m1.indexOf("<note>"));
    expect(xml).not.toContain("<wedge");
  });
  it("cresc/dim: wedge start~stop, 마디 경계에서 끝나면 앞 마디 끝", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { dynamics: [{ startBeat: 0, kind: "cresc", durationBeats: 8 }, { startBeat: 8, kind: "dim", durationBeats: 2 }] }));
    expect(count(xml, /<wedge type="crescendo"/g)).toBe(1);
    expect(count(xml, /<wedge type="diminuendo"/g)).toBe(1);
    expect(count(xml, /<wedge type="stop"/g)).toBe(2);
    const ms = xml.split("<measure ");
    // 0~8박 cresc 는 마디 2(두 번째 마디) 끝에서 stop
    expect(ms[2].indexOf('type="stop"')).toBeGreaterThan(ms[2].lastIndexOf("</note>"));
    // 8~10박 dim 은 마디 3 안에서 시작·종료
    expect(ms[3]).toContain('type="diminuendo"');
    expect(ms[3]).toContain('type="stop"');
    wellFormedXml(xml);
  });
  it("피아노: 셈여림은 멜로디 파트(P1)에만", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { dynamics: [{ startBeat: 0, kind: "mf" }] }), "piano");
    const [mel, low] = xml.split('<part id="P2">');
    expect(mel).toContain("<mf/>");
    expect(low).not.toContain("<mf/>");
  });
  it("repeat barline: 시작 left forward, 끝 right backward(마지막 마디는 하나로 합쳐짐)", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 1, kind: "repeatStart" }, { measure: 3, kind: "repeatEnd" }] }));
    expect(xml).toContain(`<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>`);
    expect(xml).toContain(`<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>`);
    expect(count(xml, /<barline location="right">/g)).toBe(1);
    const mid = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 1, kind: "repeatEnd" }] }));
    expect(count(mid, /<repeat direction="backward"\/>/g)).toBe(1);
    expect(count(mid, /<barline location="right">/g)).toBe(2);
  });
  it("끝 기호 없는 repeatStart: 마지막 마디에 backward repeat 을 명시", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 1, kind: "repeatStart" }] }));
    const last = xml.split("<measure ")[4];
    expect(last).toContain(`<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>`);
    expect(count(xml, /<repeat direction="backward"\/>/g)).toBe(1);
    expect(measureOrder(makeScore(notes4, { marks: [{ measure: 1, kind: "repeatStart" }] }))).toEqual([0, 1, 2, 3, 1, 2, 3]);
    // 짝이 맞으면 추가 backward 없음
    const paired = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 0, kind: "repeatStart" }, { measure: 1, kind: "repeatEnd" }] }));
    expect(paired.split("<measure ")[4]).not.toContain("<repeat direction=\"backward\"/>");
  });
  it("마디 중간 셈여림: 긴 음 도중은 offset(divisions), 음표 경계는 offset 없음", () => {
    const xml = scoreToMusicXML(makeScore([n(60, 0, 4)], { dynamics: [{ startBeat: 0, kind: "p" }, { startBeat: 2, kind: "f" }] }));
    expect(xml).toContain(`<dynamics><f/></dynamics></direction-type><offset>8</offset><staff>1</staff>`);
    expect(xml).not.toContain(`<dynamics><p/></dynamics></direction-type><offset>`);
    const m1 = xml.split("<measure ")[1];
    expect(m1.indexOf("<f/>")).toBeLessThan(m1.indexOf("<note>"));
  });
  it("measureRest 마디 도중 셈여림·wedge 도 offset 으로 위치 지정", () => {
    const xml = scoreToMusicXML(makeScore([], { dynamics: [{ startBeat: 1, kind: "cresc", durationBeats: 2 }, { startBeat: 3, kind: "f" }] }));
    expect(xml).toContain(`<wedge type="crescendo" number="1"/></direction-type><offset>4</offset>`);
    expect(xml).toContain(`<wedge type="stop" number="1"/></direction-type><offset>12</offset>`);
    expect(xml).toContain(`<f/></dynamics></direction-type><offset>12</offset>`);
  });
  it("wedge number: 열려 있는 wedge 와 겹치지 않는 가장 작은 번호 재사용", () => {
    const xml = scoreToMusicXML(
      makeScore(notes4, { dynamics: [{ startBeat: 0, kind: "cresc", durationBeats: 4 }, { startBeat: 2, kind: "dim", durationBeats: 4 }, { startBeat: 8, kind: "cresc", durationBeats: 2 }] }),
    );
    expect(xml).toContain(`<wedge type="crescendo" number="1"/>`);
    expect(xml).toContain(`<wedge type="diminuendo" number="2"/>`);
    expect(count(xml, /<wedge type="crescendo" number="1"\/>/g)).toBe(2);
  });
  it("피아노: repeat barline 이 두 파트 모두에", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 0, kind: "repeatStart" }, { measure: 2, kind: "repeatEnd" }] }), "piano");
    expect(count(xml, /<repeat direction="forward"\/>/g)).toBe(2);
    expect(count(xml, /<repeat direction="backward"\/>/g)).toBe(2);
  });
  it("segno/coda: 기호 + sound", () => {
    const xml = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 1, kind: "segno" }, { measure: 3, kind: "coda" }] }));
    expect(xml).toContain(`<direction-type><segno/></direction-type><sound segno="segno"/>`);
    expect(xml).toContain(`<direction-type><coda/></direction-type><sound coda="coda"/>`);
  });
  it("words: Fine·To Coda·D.C.·D.S. 와 sound 속성", () => {
    const cases: [MeasureMarkKind, string, string][] = [
      ["fine", "Fine", 'fine="yes"'],
      ["toCoda", "To Coda", 'tocoda="coda"'],
      ["dc", "D.C.", 'dacapo="yes"'],
      ["dcAlFine", "D.C. al Fine", 'dacapo="yes"'],
      ["dcAlCoda", "D.C. al Coda", 'dacapo="yes"'],
      ["ds", "D.S.", 'dalsegno="segno"'],
      ["dsAlFine", "D.S. al Fine", 'dalsegno="segno"'],
      ["dsAlCoda", "D.S. al Coda", 'dalsegno="segno"'],
    ];
    for (const [kind, words, sound] of cases) {
      const xml = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 3, kind }] }));
      expect(xml).toContain(`<words>${words}</words></direction-type><sound ${sound}/>`);
      wellFormedXml(xml);
    }
  });
  it("마디 끝 words 는 음표 뒤, 오른쪽 barline 앞", () => {
    const m = scoreToMusicXML(makeScore(notes4, { marks: [{ measure: 3, kind: "dcAlFine" }] })).split("<measure ").pop()!;
    expect(m.indexOf("D.C. al Fine")).toBeGreaterThan(m.lastIndexOf("</note>"));
    expect(m.indexOf("D.C. al Fine")).toBeLessThan(m.indexOf("<barline"));
  });
});

function wellFormedXml(xml: string) {
  const stack: string[] = [];
  for (const m of xml.replace(/<\?xml.*?\?>|<!DOCTYPE[^>]*>/g, "").matchAll(/<(\/?)([A-Za-z0-9-]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) expect(stack.pop()).toBe(m[2]);
    else stack.push(m[2]);
  }
  expect(stack).toHaveLength(0);
}
