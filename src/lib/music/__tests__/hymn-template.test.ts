import { describe, expect, it } from "vitest";
import { buildScoreTemplate, SCORE_TEMPLATES } from "../score-templates";
import { addScorePart, getScoreParts, MAIN_PART_ID, scoreForPart } from "../parts";
import { scoreToMusicXML } from "../musicxml";
import { parseScore } from "../../storage/score-schema";

const options = { template: "hymn" as const, instruments: ["choir" as const], title: "주 하나님 지으신 모든 세계", bpm: 76, meter: "4/4" as const, measures: 8, tonic: 0 };

describe("찬송가 4성부 템플릿", () => {
  it("모든 형식의 기본 박자는 4/4이고 관현악 편성과 빠르기는 유지한다", () => {
    expect(SCORE_TEMPLATES.every((preset) => preset.meter === "4/4")).toBe(true);
    expect(SCORE_TEMPLATES.find((preset) => preset.id === "orchestra")).toMatchObject({ instruments: ["flute", "oboe", "clarinet", "bassoon", "frenchHorn", "trumpet", "trombone", "tuba", "violin", "violinII", "viola", "cello", "doubleBass", "timpani", "orchestralCymbal"], bpm: 96 });
  });

  it("빈 생성은 가사·음표 없이 이름과 음자리표가 있는 독립 SATB를 보존한다", () => {
    const score = buildScoreTemplate(options);
    const parts = getScoreParts(score);
    expect(parts.map((part) => part.partName)).toEqual(["소프라노", "알토", "테너", "베이스"]);
    expect(parts.map((part) => part.clef)).toEqual(["treble", "treble", "bass", "bass"]);
    expect(new Set(parts.map((part) => part.id)).size).toBe(4);
    expect(parts.every((part) => !part.notes.length && !part.chords.length)).toBe(true);
    expect(score.measureCount).toBe(8);
    expect(parseScore(score)).toMatchObject({ partName: "소프라노", clef: "treble", parts: [{ partName: "알토" }, { partName: "테너" }, { partName: "베이스" }] });
  });

  it("예시의 첫 전통 선율과 네 성부의 음높이·박자를 따로 보관한다", () => {
    const score = buildScoreTemplate({ ...options, previewSample: true });
    const parts = getScoreParts(score);
    expect(parts[0].notes.slice(0, 9).map((note) => note.midi)).toEqual([67, 67, 67, 64, 67, 67, 67, 69, 69]);
    for (const part of parts) {
      expect(part.notes).toHaveLength(32);
      expect(part.notes[31]).toMatchObject({ startBeat: 31, durationBeats: 1 });
    }
    for (let index = 0; index < 32; index++) {
      const pitches = parts.map((part) => part.notes[index].midi!);
      expect(pitches.every((pitch, voice) => voice === 0 || pitch < pitches[voice - 1])).toBe(true);
      expect(pitches[0]).toBeGreaterThanOrEqual(60);
      expect(pitches[0]).toBeLessThanOrEqual(79);
      expect(pitches[3]).toBeGreaterThanOrEqual(36);
      expect(pitches[3]).toBeLessThanOrEqual(59);
    }
  });

  it("1~4절은 소프라노의 동일한 8마디에 네 행으로 기록하고 다른 성부에 중복하지 않는다", () => {
    const score = buildScoreTemplate({ ...options, previewSample: true });
    const parts = getScoreParts(score);
    expect(Object.keys(parts[0].notes[0].lyrics!)).toEqual(["1", "2", "3", "4"]);
    expect(parts.slice(1).every((part) => part.notes.every((note) => !note.lyrics && !note.lyric))).toBe(true);
    const xml = scoreToMusicXML(score);
    for (const verse of [1, 2, 3, 4]) expect(xml).toContain(`<lyric number="${verse}" name="${verse}절">`);
    expect(xml).not.toContain('<measure number="9">');
  });

  it("추가로 고른 악기는 네 합창 성부 뒤에 유지하고 예시 전조는 원본을 바꾸지 않는다", () => {
    const score = buildScoreTemplate({ ...options, instruments: ["piano", "choir", "bassGuitar"], previewSample: true, tonic: 2 });
    expect(getScoreParts(score).map((part) => part.instrument)).toEqual(["choir", "choir", "choir", "choir", "piano", "bassGuitar"]);
    expect(score.notes[0].midi).toBe(69);
    expect(buildScoreTemplate({ ...options, previewSample: true }).notes[0].midi).toBe(67);
  });

  it("이름 없는 베이스 파트에 소프라노의 이름과 높은음자리표를 상속하지 않는다", () => {
    const hymn = buildScoreTemplate(options);
    const expanded = addScorePart(hymn, "guitarTab", "bassGuitar");
    const bass = scoreForPart(expanded.score, expanded.partId);
    expect(bass.partName).toBeUndefined();
    expect(bass.clef).toBeUndefined();
    const xml = scoreToMusicXML(bass);
    expect(xml).toContain("베이스기타(4현)</part-name>");
    expect(xml).toContain('<clef number="1"><sign>F</sign><line>4</line></clef>');
    expect(xml).not.toContain("소프라노</part-name>");
    expect(scoreForPart(expanded.score, MAIN_PART_ID)).toMatchObject({ partName: "소프라노", clef: "treble" });
    expect(scoreForPart(expanded.score, "hymn-alto")).toMatchObject({ partName: "알토", clef: "treble" });
  });
});
