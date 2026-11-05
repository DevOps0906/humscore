import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { scoreMeasureCount } from "../edit";
import { scoreToMidi } from "../midi";
import { scoreToMusicXML } from "../musicxml";
import { getScoreParts, scoreForPart } from "../parts";
import { buildScoreTemplate, SCORE_TEMPLATES } from "../score-templates";
import { parseScore } from "../../storage/score-schema";
import { makeScore } from "./helpers";

describe("빈 템플릿 생성", () => {
  for (const preset of SCORE_TEMPLATES) it(`${preset.title}은 선택한 편성·조성·박자·마디 수만 유지한다`, () => {
    const score = buildScoreTemplate({ template: preset.id, instruments: [...preset.instruments], title: "  새 악보  ", bpm: 97, meter: "3/4", measures: 9, tonic: 2 });
    expect(parseScore(score)).not.toBeNull();
    expect(score).toMatchObject({ title: "새 악보", bpm: 97, meter: "3/4", beatsPerMeasure: 3, key: { tonic: 2 }, measureCount: 9 });
    expect(getScoreParts(score).map((part) => part.instrument)).toEqual(preset.id === "hymn" ? ["choir", "choir", "choir", "choir"] : preset.instruments);
    for (const part of getScoreParts(score)) {
      expect(part.notes).toEqual([]);
      expect(part.chords).toEqual([]);
      expect(part.dynamics ?? []).toEqual([]);
      expect(scoreMeasureCount(scoreForPart(score, part.id))).toBe(9);
    }
    expect(score.marks ?? []).toEqual([]);
    expect(scoreToMusicXML(score)).toContain('<measure number="9">');
    expect(scoreToMusicXML(score)).not.toContain("<pitch>");
    expect(scoreToMusicXML(score)).not.toContain("<unpitched>");
    expect(new Midi(scoreToMidi(score)).tracks.flatMap((track) => track.notes)).toEqual([]);
  });

  it("작사·작곡·편곡자를 각각 정리해서 저장하고 빈 이름은 제외한다", () => {
    const score = buildScoreTemplate({ template: "piano", instruments: ["piano"], title: "제목", bpm: 80, meter: "4/4", measures: 5, tonic: 0, lyricist: "  작사가  ", composer: " 작곡가 ", arranger: "  " });
    expect(score.lyricist).toBe("작사가");
    expect(score.composer).toBe("작곡가");
    expect(score.arranger).toBeUndefined();
    expect(scoreMeasureCount(score)).toBe(5);
    expect(scoreToMusicXML(score)).toContain('<creator type="lyricist">작사가</creator>');
    expect(scoreToMusicXML(score)).toContain('<creator type="composer">작곡가</creator>');
  });
});

describe("명시한 마디 수", () => {
  it("구버전의 길이 계산을 유지하고 추가 파트가 길면 지정 마디 수보다 늘어난다", () => {
    expect(scoreMeasureCount(makeScore([]))).toBe(1);
    expect(scoreMeasureCount(makeScore([], { measureCount: 9 }))).toBe(9);
    expect(scoreMeasureCount(makeScore([{ midi: 60, startBeat: 36, durationBeats: 1 }], { measureCount: 9 }))).toBe(10);
    expect(scoreMeasureCount(makeScore([], { measureCount: 9, chords: [{ startBeat: 40, symbol: "C" }] }))).toBe(11);
    const score = makeScore([], { measureCount: 9, parts: [{ id: "bass", instrument: "bassGuitar", notation: "guitarTab", notes: [{ midi: 40, startBeat: 44, durationBeats: 1 }], chords: [] }] });
    expect(scoreMeasureCount(score)).toBe(12);
  });
});

describe("드럼 하이햇 방향", () => {
  it("손 하이햇은 위로, 페달은 아래로 향하고 동시 타격은 손·발 두 성부에 보존한다", () => {
    const notes = [36, 38, 42, 44, 46].map((midi) => ({ midi, startBeat: 0, durationBeats: 0.5 }));
    const score = makeScore(notes, { instrument: "drumKit", notation: "drums" });
    const xml = scoreToMusicXML(score);
    const sounding = (xml.match(/<note[^>]*>.*?<\/note>/g) ?? []).filter((note) => note.includes("<unpitched>"));
    expect(sounding).toHaveLength(5);
    for (const midi of [38, 42, 46]) expect(sounding.find((note) => note.includes(`<instrument id="D${midi}"/>`))).toContain("<stem>up</stem>");
    for (const midi of [36, 44]) expect(sounding.find((note) => note.includes(`<instrument id="D${midi}"/>`))).toContain("<stem>down</stem>");
    expect(new Set(sounding.map((note) => note.match(/<voice>(\d+)<\/voice>/)?.[1])).size).toBe(2);
    expect(xml.match(/<backup>/g)).toHaveLength(1);
    expect(xml.match(/<chord\/>/g)).toHaveLength(3);
    expect(xml).not.toContain("<harmony>");
    expect(score.notes).toEqual(notes);
  });
});
