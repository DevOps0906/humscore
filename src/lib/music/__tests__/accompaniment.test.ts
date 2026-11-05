import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { ARPEGGIO_PATTERNS, buildAccompanimentNotes, isArpeggioPatternId } from "../accompaniment";
import { buildPlaybackPlan } from "../playback-plan";
import { scoreToMidi } from "../midi";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";

const chords = [{ symbol: "C", startBeat: 0 }, { symbol: "G", startBeat: 4 }];
const options = { endBeat: 8, beatsPerMeasure: 4 };

describe("반주 패턴", () => {
  it("서로 다른 10개 템플릿과 안전한 식별자를 제공한다", () => {
    expect(ARPEGGIO_PATTERNS).toHaveLength(10);
    expect(new Set(ARPEGGIO_PATTERNS.map((entry) => entry.id)).size).toBe(10);
    expect(isArpeggioPatternId("ascending")).toBe(true);
    expect(isArpeggioPatternId("__proto__")).toBe(false);
    const signatures = ARPEGGIO_PATTERNS.map((pattern) => JSON.stringify(buildAccompanimentNotes(chords, { mode: "arpeggio", pattern: pattern.id }, options)));
    expect(new Set(signatures).size).toBe(10);
  });
  it("알베르티 베이스는 낮음·높음·중간·높음 순서다", () => {
    const notes = buildAccompanimentNotes(chords, { mode: "arpeggio", pattern: "alberti" }, options);
    expect(notes.slice(0, 4).map((note) => note.midi)).toEqual([48, 55, 52, 55]);
    expect(notes.slice(0, 4).map((note) => note.startBeat)).toEqual([0, 0.5, 1, 1.5]);
  });
  it("코드 변경·마지막 박·재생 재개 경계에서 음을 자른다", () => {
    const notes = buildAccompanimentNotes([{ symbol: "C", startBeat: 0 }, { symbol: "Dm", startBeat: 1.25 }], { mode: "arpeggio", pattern: "ascending" }, { ...options, endBeat: 2.25, fromBeat: 0.75 });
    expect(notes[0]).toMatchObject({ startBeat: 0.75, durationBeats: 0.25, midi: 52 });
    expect(notes.find((note) => note.startBeat === 1)).toMatchObject({ durationBeats: 0.25 });
    expect(notes.find((note) => note.startBeat === 1.25)?.midi).toBe(50);
    expect(Math.max(...notes.map((note) => note.startBeat + note.durationBeats))).toBe(2.25);
  });
  it("6/8 내부 3박과 전조를 지원하며 원본 코드는 보존한다", () => {
    const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 3 }], { meter: "6/8", beatsPerMeasure: 3, chords: [{ symbol: "C", startBeat: 0 }], transpose: 2, accompaniment: { mode: "arpeggio", pattern: "ascending" } });
    const notes = buildAccompanimentNotes(score.chords, score.accompaniment, { endBeat: 3, beatsPerMeasure: 3, transpose: 2 });
    expect(notes).toHaveLength(6);
    expect(notes[0].midi).toBe(50);
    expect(score.chords[0].symbol).toBe("C");
    const plan = buildPlaybackPlan(score);
    expect(plan.accompaniment).toEqual(score.accompaniment);
    const midi = new Midi(scoreToMidi(score));
    expect(midi.tracks[1].notes).toHaveLength(6);
    expect(midi.tracks[1].notes.map((note) => note.midi)).toEqual(notes.map((note) => note.midi));
    expect(midi.tracks[1].notes[5].time).toBeCloseTo(1.25);
    const xml = scoreToMusicXML(score, "piano");
    const lower = xml.split('<part id="P2">')[1];
    expect(lower).not.toContain("<chord/>");
    expect(lower.match(/<type>eighth<\/type>/g)).toHaveLength(6);
  });
  it("화음 반주 및 설정 없는 기존 악보는 동시 화음으로 남는다", () => {
    const notes = buildAccompanimentNotes(chords, undefined, options);
    expect(notes.filter((note) => note.startBeat === 0)).toHaveLength(3);
    expect(notes[0].durationBeats).toBe(4);
    const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 4 }], { chords: [{ symbol: "C", startBeat: 0 }] });
    const lower = scoreToMusicXML(score, "piano").split('<part id="P2">')[1];
    expect(lower).toContain("<chord/>");
  });
  it("잘못된 패턴은 상행으로 복원하고 무효 길이는 비운다", () => {
    expect(buildAccompanimentNotes(chords, { mode: "arpeggio", pattern: "unknown" }, options)).toEqual(buildAccompanimentNotes(chords, { mode: "arpeggio", pattern: "ascending" }, options));
    expect(buildAccompanimentNotes(chords, undefined, { ...options, endBeat: NaN })).toEqual([]);
  });
});
