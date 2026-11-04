import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { DRUM_PIECES, drumPiece } from "../drums";
import { scoreToMidi } from "../midi";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";

describe("드럼 악보와 MIDI", () => {
  it("음높이·표기 위치를 따로 정의하고 필수 드럼을 제공한다", () => {
    expect(new Set(DRUM_PIECES.map((piece) => piece.midi)).size).toBe(DRUM_PIECES.length);
    expect(drumPiece(36)?.label).toContain("베이스");
    expect(drumPiece(42)?.head).toBe("x");
    expect(drumPiece(38)?.head).toBe("normal");
    expect(drumPiece(127)).toBeUndefined();
  });

  it("드럼은 MIDI 10번 채널과 원래 타격 번호를 쓰고 동시 타격·반복을 보존한다", () => {
    const score = makeScore([
      { midi: 36, startBeat: 0, durationBeats: 0.5 },
      { midi: 42, startBeat: 0, durationBeats: 0.5 },
      { midi: 38, startBeat: 1, durationBeats: 0.5 },
    ], { notation: "drums", instrument: "drumKit", transpose: 7, chords: [{ startBeat: 0, symbol: "C" }], marks: [{ measure: 0, kind: "repeatEnd" }] });
    const before = JSON.stringify(score);
    const midi = new Midi(scoreToMidi(score, { melodyInstrument: "piano" }));
    expect(midi.tracks).toHaveLength(1);
    expect(midi.tracks[0].channel).toBe(9);
    expect(midi.tracks[0].notes.map((note) => note.midi)).toEqual([36, 42, 38, 36, 42, 38]);
    expect(midi.tracks[0].notes[0].time).toBe(midi.tracks[0].notes[1].time);
    expect(JSON.stringify(score)).toBe(before);
  });

  it("드럼 MusicXML은 무음높이·타악 음자리표·X 머리·독립 성부를 사용한다", () => {
    const score = makeScore([
      { midi: 36, startBeat: 0, durationBeats: 0.5 },
      { midi: 42, startBeat: 0, durationBeats: 0.5 },
      { midi: 38, startBeat: 1, durationBeats: 0.5 },
    ], { notation: "drums", instrument: "drumKit", transpose: 12 });
    const xml = scoreToMusicXML(score, "piano", { minMeasures: 2 });
    expect(xml).toContain("<sign>percussion</sign>");
    expect(xml).toContain("<unpitched>");
    expect(xml).toContain("<notehead>x</notehead>");
    expect(xml).toContain("<midi-channel>10</midi-channel>");
    expect(xml).toContain("<midi-unpitched>37</midi-unpitched>");
    expect(xml).toContain("<backup><duration>16</duration></backup>");
    expect(xml).toContain("<voice>3</voice>");
    expect(xml).not.toContain("<pitch>");
    expect(xml.match(/<measure /g)).toHaveLength(2);
    expect(xml).toContain('<rest measure="yes"/>');
  });

  it("같은 북을 다시 칠 때 앞 소리를 잘라도 타격 시각은 밀지 않는다", () => {
    const xml = scoreToMusicXML(makeScore([
      { midi: 38, startBeat: 0, durationBeats: 2 },
      { midi: 38, startBeat: 0.5, durationBeats: 0.5 },
    ], { notation: "drums" }));
    expect(xml.match(/<unpitched>/g)).toHaveLength(2);
    expect(xml).toContain("<duration>2</duration>");
    expect(scoreToMusicXML(makeScore([], { notation: "drums" }))).toContain('<rest measure="yes"/>');
  });
});
