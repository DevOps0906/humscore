import { describe, expect, it } from "vitest";
import { buildScoreTemplate } from "../score-templates";
import { scoreToMusicXML } from "../musicxml";
import { resolveTextSizes, scoreTypography } from "../header-fonts";
import { parseScore } from "../../storage/score-schema";
import { parseKeysDraft } from "../../storage/keys-draft";

const options = { template: "hymn" as const, instruments: ["choir" as const], title: "찬송가", bpm: 76, meter: "4/4" as const, measures: 8, tonic: 0, previewSample: true };

describe("찬송가 큰보표", () => {
  it("소프라노·알토와 테너·베이스를 두 보표(성부 1·2, 줄기 위·아래)로 묶고 대괄호로 잇는다", () => {
    const xml = scoreToMusicXML(buildScoreTemplate(options), "piano", { externalHeader: true });
    expect(xml.match(/<part id="/g)).toHaveLength(2);
    expect(xml).toContain("<group-symbol>bracket</group-symbol>");
    expect(xml).toContain("<group-barline>yes</group-barline>");
    expect(xml.match(/<measure number="/g)).toHaveLength(16);
    expect(xml).toContain("<voice>2</voice>");
    expect(xml).toContain("<stem>up</stem>");
    expect(xml).toContain("<stem>down</stem>");
    expect(xml.match(/<backup>/g)).toHaveLength(16);
    expect(xml.match(/<clef number="1"><sign>F<\/sign>/g)).toHaveLength(1);
    for (const verse of [1, 2, 3, 4]) expect(xml).toContain(`<lyric number="${verse}" name="${verse}절">`);
  });

  it("빈 찬송가는 성부 겹침 없이 두 보표의 온쉼표 마디만 둔다", () => {
    const xml = scoreToMusicXML(buildScoreTemplate({ ...options, previewSample: false }), "piano", { externalHeader: true });
    expect(xml).not.toContain("<backup>");
    expect(xml).not.toContain("<voice>2</voice>");
  });

  it("satbGrandStaff:false 면 성부마다 보표를 따로 그린다", () => {
    const xml = scoreToMusicXML(buildScoreTemplate(options), "piano", { externalHeader: true, satbGrandStaff: false });
    expect(xml.match(/<part id="/g)).toHaveLength(4);
    expect(xml).not.toContain("<group-symbol>bracket</group-symbol>");
  });
});

describe("항목별 글자 크기", () => {
  it("값이 없으면 기본 크기를, 있으면 10~48로 맞춘 값을 쓴다", () => {
    expect(resolveTextSizes({})).toEqual({ base: 14, title: 24, credit: 14, lyric: 14, chord: 14 });
    expect(resolveTextSizes({ headerFontSize: 20, titleFontSize: 99, creditFontSize: 3, lyricFontSize: 17, chordFontSize: 22 }))
      .toEqual({ base: 20, title: 48, credit: 10, lyric: 17, chord: 22 });
    expect(scoreTypography({ headerFontSize: 16, lyricFontSize: 18 })).toMatchObject({ fontSize: 16, lyricSize: 18, titleSize: undefined });
  });

  it("저장 스키마와 초안이 네 필드를 왕복하고 범위 밖 값은 거부·무시한다", () => {
    const score = { ...buildScoreTemplate({ ...options, previewSample: false }), titleFontSize: 30, creditFontSize: 12, lyricFontSize: 16, chordFontSize: 18 };
    expect(parseScore(score)).toMatchObject({ titleFontSize: 30, creditFontSize: 12, lyricFontSize: 16, chordFontSize: 18 });
    expect(parseScore({ ...score, lyricFontSize: 9 })).toBeNull();
    const draft = JSON.stringify({ notes: [], bpm: 90, meter: "4/4", titleFontSize: 30, lyricFontSize: 99, chordFontSize: 18 });
    expect(parseKeysDraft(draft)).toMatchObject({ titleFontSize: 30, chordFontSize: 18 });
    expect(parseKeysDraft(draft)?.lyricFontSize).toBeUndefined();
  });
});
