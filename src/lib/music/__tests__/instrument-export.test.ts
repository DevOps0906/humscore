import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { GM_INSTRUMENTS, INSTRUMENT_LABELS, INSTRUMENT_ORDER, ORCHESTRAL_DRUM_NOTES, instrumentMode } from "../instrument-catalog";
import { scoreToMidi } from "../midi";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";

describe("선택 악기 내보내기", () => {
  it("음표가 없는 오케스트라 타악기도 선택한 악기의 MIDI 정보를 유지한다", () => {
    for (const instrument of ["orchestralSnare", "orchestralBassDrum", "orchestralCymbal", "triangle"] as const) {
      const xml = scoreToMusicXML(makeScore([], { instrument, notation: "orchestra" }));
      expect(xml).toContain(`<midi-unpitched>${ORCHESTRAL_DRUM_NOTES[instrument]! + 1}</midi-unpitched>`);
      expect(xml).toContain(`<instrument-name>${INSTRUMENT_LABELS[instrument]}</instrument-name>`);
    }
  });
  for (const instrument of INSTRUMENT_ORDER) {
    it(`${instrument}의 MIDI 프로그램과 MusicXML 음색 정보를 유지한다`, () => {
      const fixedDrum = ORCHESTRAL_DRUM_NOTES[instrument];
      const percussion = instrument === "drumKit" || fixedDrum !== undefined;
      const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 1 }], {
        instrument, notation: instrumentMode(instrument), transpose: 5,
        chords: [{ symbol: "C", startBeat: 0 }],
      });
      const midi = new Midi(scoreToMidi(score));
      expect(midi.tracks[0].channel).toBe(percussion ? 9 : 0);
      expect(midi.tracks[0].instrument.number).toBe(GM_INSTRUMENTS[instrument]);
      expect(midi.tracks[0].notes[0].midi).toBe(fixedDrum ?? (percussion ? 60 : 65));
      expect(midi.tracks).toHaveLength(percussion ? 1 : 2);
      const xml = scoreToMusicXML(score);
      if (percussion) {
        expect(xml).toContain("<sign>percussion</sign>");
        expect(xml).toContain("<unpitched>");
        expect(xml).not.toContain("<pitch>");
        expect(xml).toContain("<midi-channel>10</midi-channel>");
        expect(xml).toContain(`<midi-unpitched>${(fixedDrum ?? 60) + 1}</midi-unpitched>`);
        if (fixedDrum !== undefined) expect(xml).toContain(`<part-name>${INSTRUMENT_LABELS[instrument]}</part-name>`);
      } else {
        expect(xml).toContain(`<instrument-name>${INSTRUMENT_LABELS[instrument]}</instrument-name>`);
        expect(xml).toContain(`<midi-program>${GM_INSTRUMENTS[instrument] + 1}</midi-program>`);
        expect(xml).toContain("<midi-channel>1</midi-channel>");
        expect(xml).not.toContain("<unpitched>");
      }
      expect(score.notes[0].midi).toBe(60);
      expect(score.transpose).toBe(5);
    });
  }

  it("트라이앵글을 이름과 X형 음표로 표기한다", () => {
    const xml = scoreToMusicXML(makeScore([{ midi: 60, startBeat: 0, durationBeats: 1 }], { instrument: "triangle", notation: "orchestra" }));
    expect(xml).toContain("<instrument-name>트라이앵글</instrument-name>");
    expect(xml).toContain("<notehead>x</notehead>");
    expect(xml).toContain("<display-step>E</display-step><display-octave>5</display-octave>");
    expect(xml).not.toContain("드럼 81");
  });

  it("두 파트 레이아웃에서 선율 악기와 피아노 반주 채널을 구별한다", () => {
    const xml = scoreToMusicXML(makeScore([{ midi: 60, startBeat: 0, durationBeats: 1 }], { instrument: "flute" }), "piano");
    expect(xml).toContain('<score-instrument id="P1-I1"><instrument-name>플루트</instrument-name>');
    expect(xml).toContain('<midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>74</midi-program>');
    expect(xml).toContain('<midi-instrument id="P2-I1"><midi-channel>2</midi-channel><midi-program>1</midi-program>');
  });
});
