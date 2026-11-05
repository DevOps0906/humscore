import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { DRUM_PIECES, drumPiece } from "../drums";
import { scoreToMidi } from "../midi";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";

function xmlAttacks(xml: string) {
  const attacks: { midi: number; beat: number; voice: number }[] = [];
  let measure = 0;
  for (const match of xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)) {
    let cursor = 0;
    let onset = 0;
    for (const token of match[1].matchAll(/<note(?:\s[^>]*)?>[\s\S]*?<\/note>|<backup>[\s\S]*?<\/backup>/g)) {
      const text = token[0];
      const duration = Number(text.match(/<duration>(\d+)<\/duration>/)?.[1] ?? 0) / 4;
      if (text.startsWith("<backup>")) { cursor -= duration; continue; }
      if (!text.includes("<chord/>")) { onset = cursor; cursor += duration; }
      const midi = text.match(/<instrument id="D(\d+)"\/>/)?.[1];
      if (midi && !text.includes('<tie type="stop"/>')) attacks.push({ midi: Number(midi), beat: measure * 4 + onset, voice: Number(text.match(/<voice>(\d+)<\/voice>/)?.[1]) });
    }
    measure++;
  }
  return attacks;
}

describe("드럼 악보와 MIDI", () => {
  it("음높이·표기 위치를 따로 정의하고 필수 드럼을 제공한다", () => {
    expect(new Set(DRUM_PIECES.map((piece) => piece.midi)).size).toBe(DRUM_PIECES.length);
    expect(drumPiece(36)?.label).toContain("베이스");
    expect(drumPiece(42)?.head).toBe("x");
    expect(drumPiece(38)?.head).toBe("normal");
    expect(drumPiece(47)?.label).toBe("미들팜");
    expect(drumPiece(51)?.head).toBe("diamond");
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
    expect(xml).toContain("<voice>2</voice>");
    expect(xml).not.toContain("<voice>3</voice>");
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

  it("8비트 기본 리듬의 손·발을 두 성부로 묶고 모든 타격 시점을 그대로 보존한다", () => {
    const notes = Array.from({ length: 8 }, (_, index) => ({ midi: 42, startBeat: index / 2, durationBeats: 0.5 }));
    notes.push(...[0, 2].map((startBeat) => ({ midi: 36, startBeat, durationBeats: 0.5 })), ...[1, 3].map((startBeat) => ({ midi: 38, startBeat, durationBeats: 0.5 })));
    const score = makeScore(notes, { notation: "drums", instrument: "drumKit" });
    const before = JSON.stringify(score);
    const xml = scoreToMusicXML(score);
    const attacks = xmlAttacks(xml);
    expect(attacks.filter((note) => note.midi === 42).map((note) => note.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(attacks.filter((note) => note.midi === 38).map((note) => note.beat)).toEqual([1, 3]);
    expect(attacks.filter((note) => note.midi === 36).map((note) => note.beat)).toEqual([0, 2]);
    expect(attacks.every((note) => note.voice === (note.midi === 36 ? 2 : 1))).toBe(true);
    expect(xml.match(/<chord\/>/g)).toHaveLength(2);
    expect(xml.match(/<beam number="1">begin<\/beam>/g)).toHaveLength(4);
    expect(xml.match(/<beam number="1">end<\/beam>/g)).toHaveLength(4);
    expect(xml).not.toContain("<voice>3</voice>");
    expect(JSON.stringify(score)).toBe(before);
  });

  it("16분 필인은 한 박 안에서만 두 줄 빔으로 연결하고 열린 하이햇과 라이드 머리를 구분한다", () => {
    const notes = [50, 47, 43, 38].map((midi, index) => ({ midi, startBeat: index / 4, durationBeats: 0.25 }));
    notes.push({ midi: 46, startBeat: 1, durationBeats: 0.5 }, { midi: 42, startBeat: 1.5, durationBeats: 0.5 }, { midi: 51, startBeat: 2, durationBeats: 1 });
    const xml = scoreToMusicXML(makeScore(notes, { notation: "drums" }));
    expect(xmlAttacks(xml).map((note) => [note.midi, note.beat])).toEqual(notes.map((note) => [note.midi, note.startBeat]));
    for (const level of [1, 2]) {
      expect(xml.match(new RegExp(`<beam number="${level}">continue<\\/beam>`, "g"))).toHaveLength(2);
    }
    expect(xml).toContain("<technical><open-string/></technical>");
    expect(xml).toContain("<technical><stopped/></technical>");
    expect(xml).toContain('<notehead filled="no">diamond</notehead>');
  });
});
