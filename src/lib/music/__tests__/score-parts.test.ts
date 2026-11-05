import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { makeScore } from "./helpers";
import { addScorePart, getScoreParts, scoreForPart, updateScorePart } from "../parts";
import { scoreToMusicXML } from "../musicxml";
import { scoreToMidi } from "../midi";
import { buildPlaybackPlan } from "../playback-plan";
import { canTie, mergeTiedNotes } from "../articulation";
import { buildScoreTemplate, SCORE_TEMPLATES } from "../score-templates";
import { parseScore } from "../../storage/score-schema";
import { parseKeysDraft, serializeKeysDraft } from "../../storage/keys-draft";
import { INSTRUMENT_ORDER, ORCHESTRAL_DRUM_NOTES, instrumentMode } from "../instrument-catalog";

const id = "3347e758-991e-41c8-a722-5666f0203990";
const root = () => makeScore([{ midi: 72, startBeat: 0, durationBeats: 4 }], {
  id, instrument: "piano", notation: "piano", transpose: 2,
  parts: [
    { id: "bass", instrument: "bassGuitar5", notation: "guitarTab", notes: [{ midi: 28, startBeat: 0, durationBeats: 8 }], chords: [] },
    { id: "drums", instrument: "drumKit", notation: "drums", notes: [{ midi: 38, startBeat: 4, durationBeats: 1 }], chords: [] },
    { id: "viola", instrument: "viola", notation: "orchestra", notes: [{ midi: 55, startBeat: 0, durationBeats: 2 }], chords: [] },
  ],
});

describe("악기별 독립 악보", () => {
  it("추가·전환·수정은 다른 파트의 음표와 코드를 바꾸지 않는다", () => {
    const source = root();
    const added = addScorePart(source, "orchestra", "flute");
    const changed = updateScorePart(added.score, added.partId, { notes: [{ midi: 81, startBeat: 0, durationBeats: 1 }], chords: [{ symbol: "G", startBeat: 0 }] });
    expect(changed.notes).toEqual(source.notes);
    expect(changed.parts?.slice(0, 3)).toEqual(source.parts);
    expect(scoreForPart(changed, added.partId).notes[0].midi).toBe(81);
    expect(addScorePart(changed, "orchestra", "flute").partId).toBe(added.partId);
    expect(scoreForPart(changed, "drums").transpose).toBe(0);
    expect(scoreForPart(changed, "bass").parts).toBeUndefined();
  });
  it("검증·직렬화·초안 복원 뒤에도 모든 파트와 활성 선택이 남는다", () => {
    const source = root();
    expect(parseScore(JSON.parse(JSON.stringify(source)))).toEqual(source);
    const draft = parseKeysDraft(serializeKeysDraft({ ...source, meter: "4/4", progressionId: "auto", activePartId: "bass", scoreId: id }));
    expect(draft?.parts).toEqual(source.parts);
    expect(draft?.activePartId).toBe("bass");
    expect(parseScore({ ...source, parts: [source.parts![0], source.parts![0]] })).toBeNull();
  });
  it("XML은 악기별 part와 음자리표·동일 마디 수를 가지며 ID가 겹치지 않는다", () => {
    const xml = scoreToMusicXML(root());
    const parts = [...xml.matchAll(/<part id="([^"]+)">([\s\S]*?)<\/part>/g)];
    expect(parts).toHaveLength(4);
    expect(new Set(parts.map((match) => match[1])).size).toBe(4);
    expect(parts.map((match) => [...match[2].matchAll(/<measure number=/g)].length)).toEqual([2, 2, 2, 2]);
    expect(parts[1][2]).toContain("<sign>F</sign>");
    expect(parts[1][2]).not.toContain("<step>C</step><octave>6</octave>");
    expect(parts[2][2]).toContain("<sign>percussion</sign>");
    expect(parts[3][2]).toContain("<sign>C</sign><line>3</line>");
  });
  it("MIDI는 악기별 트랙과 저음·타악 음높이를 유지한다", () => {
    const midi = new Midi(scoreToMidi(root(), { withChords: false }));
    expect(midi.tracks).toHaveLength(4);
    expect(midi.tracks.map((track) => track.notes[0].midi)).toEqual([74, 30, 38, 57]);
    expect(midi.tracks[1].instrument.number).toBe(33);
    expect(midi.tracks[2].channel).toBe(9);
    expect(new Set(midi.tracks.filter((track) => track.channel !== 9).map((track) => track.channel)).size).toBe(3);
  });
  it("16개 이상의 선율 음색은 MIDI와 XML에서 포트로 분리한다", () => {
    const instruments = INSTRUMENT_ORDER.filter((instrument) => instrument !== "drumKit" && ORCHESTRAL_DRUM_NOTES[instrument] === undefined).slice(0, 18);
    const parts = instruments.map((instrument, index) => ({ id: `p${index}`, instrument, notation: instrumentMode(instrument), notes: [{ midi: 60, startBeat: 0, durationBeats: 1 }], chords: [] }));
    const score = { ...root(), ...parts[0], id, parts: parts.slice(1) };
    const bytes = scoreToMidi(score, { withChords: false });
    const midi = new Midi(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ports: number[] = [];
    let offset = 8 + view.getUint32(4);
    while (offset + 8 <= bytes.length) {
      expect([...bytes.slice(offset + 8, offset + 12)]).toEqual([0, 255, 33, 1]);
      ports.push(bytes[offset + 12]);
      offset += 8 + view.getUint32(offset + 4);
    }
    expect(midi.tracks).toHaveLength(18);
    expect(new Set(midi.tracks.map((track, index) => `${ports[index + 1]}:${track.channel}`)).size).toBe(18);
    expect(scoreToMusicXML(score)).toMatch(/<midi-device[^>]+port="2"/);
  });
  it("반복과 A-B 구간에서 짧은 파트도 곡 전체 마디 순서에 맞춘다", () => {
    const source = { ...root(), marks: [{ measure: 0, kind: "repeatStart" as const }, { measure: 1, kind: "repeatEnd" as const }] };
    const repeated = buildPlaybackPlan(source);
    expect(repeated.parts?.[0].notes.map((note) => note.startBeat)).toEqual([0, 8]);
    expect(repeated.parts?.[1].notes.map((note) => note.startBeat)).toEqual([4, 12]);
    expect(repeated.totalBeats).toBe(16);
    const range = buildPlaybackPlan(source, { startMeasure: 2, endMeasure: 2 });
    expect(range.totalBeats).toBe(4);
    expect(range.parts?.[1].notes[0].startBeat).toBe(0);
  });
  it("추가 악기에서 편집한 반복 기호도 곡 전체와 모든 보표에 적용한다", () => {
    const changed = updateScorePart(root(), "bass", { marks: [{ measure: 0, kind: "repeatStart" }, { measure: 1, kind: "repeatEnd" }] });
    expect(changed.marks).toHaveLength(2);
    expect(scoreForPart(changed, "drums").marks).toEqual(changed.marks);
    expect(buildPlaybackPlan(changed).parts?.[1].notes.map((note) => note.startBeat)).toEqual([4, 12]);
  });
});

describe("붙임줄·이음줄", () => {
  const notes = [{ midi: 60, startBeat: 0, durationBeats: 1, tieToNext: true }, { midi: 60, startBeat: 1, durationBeats: 1, slurToNext: true }, { midi: 64, startBeat: 2, durationBeats: 1 }];
  it("같은 높이의 붙임줄만 한 번 발음하고 이음줄은 각각 발음한다", () => {
    expect(canTie(notes, 0)).toBe(true);
    expect(canTie(notes, 1)).toBe(false);
    expect(mergeTiedNotes(notes).map((note) => [note.midi, note.durationBeats])).toEqual([[60, 2], [64, 1]]);
    const midi = new Midi(scoreToMidi(makeScore(notes), { withChords: false }));
    expect(midi.tracks[0].notes).toHaveLength(2);
    expect(midi.tracks[0].notes[0].duration).toBe(1);
  });
  it("XML에 소리용 tie와 표기용 tied·slur를 모두 기록한다", () => {
    const xml = scoreToMusicXML(makeScore(notes));
    for (const element of ["tie", "tied", "slur"]) for (const type of ["start", "stop"]) expect(xml).toContain(`<${element} type="${type}"`);
    expect(parseScore({ ...makeScore(notes), id })?.notes).toEqual(notes);
  });
});

describe("참고 자료 기반 템플릿", () => {
  for (const preset of SCORE_TEMPLATES) it(`${preset.title}은 편성·음표·마디가 있는 편집 가능한 악보다`, () => {
    const score = buildScoreTemplate({ template: preset.id, instruments: [...preset.instruments], title: preset.title, bpm: preset.bpm, meter: preset.meter, measures: 8, tonic: 2, previewSample: true });
    expect(parseScore(score)).not.toBeNull();
    expect(getScoreParts(score).map((part) => part.instrument)).toEqual(preset.id === "hymn" ? ["choir", "choir", "choir", "choir"] : preset.instruments);
    for (const part of getScoreParts(score)) {
      expect(part.notes.length).toBeGreaterThan(0);
      expect(Math.max(...part.notes.map((note) => note.startBeat + note.durationBeats))).toBeLessThanOrEqual(score.beatsPerMeasure * 8);
    }
    expect(scoreToMusicXML(score, "piano")).toContain("<measure number=\"8\">");
    expect(new Midi(scoreToMidi(score))).toBeDefined();
  });
});
