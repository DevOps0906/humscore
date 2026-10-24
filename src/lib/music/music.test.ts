import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import { centsOff, freqToNearestMidi, midiToFreq, midiToName, pitchClassName, PIANO_KEYS } from "./frequency";
import { buildScoreFromFrames } from "./pipeline";
import { scoreToMusicXML } from "./musicxml";
import { scoreToMidi } from "./midi";
import { transposeChordSymbol, transposeKey } from "./theory";
import type { PitchFrame } from "./types";

/** 테스트용 가짜 허밍: [midi|null, 박 수] 목록을 60fps 피치 프레임으로 변환 (약간의 음정 흔들림 포함) */
function hum(melody: [number | null, number][], bpm: number, detuneCents = 12): PitchFrame[] {
  const spb = 60 / bpm;
  const frames: PitchFrame[] = [];
  let t = 0;
  for (const [midi, beats] of melody) {
    const end = t + beats * spb;
    let k = 0;
    for (; t < end; t += 1 / 60, k++) {
      const gap = end - t < 0.04; // 음 사이 숨
      const wobble = Math.sin(k / 3) * detuneCents;
      frames.push(
        midi === null || gap
          ? { time: t, freq: null, clarity: 0.2 }
          : { time: t, freq: midiToFreq(midi) * Math.pow(2, wobble / 1200), clarity: 0.97 },
      );
    }
    t = end;
  }
  return frames;
}

describe("88건반 주파수", () => {
  it("A0~C8, 88개, A4=440", () => {
    expect(PIANO_KEYS).toHaveLength(88);
    expect(PIANO_KEYS[0].freq).toBeCloseTo(27.5, 3);
    expect(PIANO_KEYS[87].freq).toBeCloseTo(4186.01, 1);
    expect(PIANO_KEYS[48]).toMatchObject({ keyNumber: 49, midi: 69, name: "A4", freq: 440 });
    expect(PIANO_KEYS.filter((k) => k.isBlack)).toHaveLength(36);
  });
  it("Hz → 음표 + 센트 오차", () => {
    expect(freqToNearestMidi(261.63)).toBe(60);
    expect(centsOff(445)).toBeCloseTo(19.56, 1);
  });

  it("midiToName: 샵·플랫 표기", () => {
    // MIDI 60 = C4 (샵/플랫 무관하게 동일)
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(60, true)).toBe("C4");

    // MIDI 69 = A4
    expect(midiToName(69)).toBe("A4");
    expect(midiToName(69, true)).toBe("A4");

    // MIDI 70 = A#4 (기본: 샵) / Bb4 (플랫 선호)
    expect(midiToName(70)).toBe("A#4");
    expect(midiToName(70, true)).toBe("Bb4");

    // MIDI 61 = C#4 / Db4
    expect(midiToName(61)).toBe("C#4");
    expect(midiToName(61, true)).toBe("Db4");
  });

  it("pitchClassName: 피치 클래스 이름", () => {
    // pc=0 → "C", pc=11 → "B" (샵/플랫 무관)
    expect(pitchClassName(0)).toBe("C");
    expect(pitchClassName(0, true)).toBe("C");
    expect(pitchClassName(11)).toBe("B");
    expect(pitchClassName(11, true)).toBe("B");

    // pc=1 → "C#" (기본) / "Db" (플랫 선호)
    expect(pitchClassName(1)).toBe("C#");
    expect(pitchClassName(1, true)).toBe("Db");

    // MIDI 값을 그대로 넘겨도 pitchClass 변환을 거치므로 동일 결과
    expect(pitchClassName(12)).toBe("C");  // MIDI 12 → pc=0 → "C"
    expect(pitchClassName(13)).toBe("C#"); // MIDI 13 → pc=1 → "C#"
  });
});

describe("허밍 채보 파이프라인", () => {
  // 학교종: 솔솔라라 솔솔미- 솔솔미미 레-- (C장조)
  const melody: [number, number][] = [
    [67, 1], [67, 1], [69, 1], [69, 1],
    [67, 1], [67, 1], [64, 2],
    [67, 1], [67, 1], [64, 1], [64, 1],
    [62, 3], [60, 1],
  ];
  const { score, meanAbsCents } = buildScoreFromFrames(hum(melody, 100), { bpm: 100, beatsPerMeasure: 4, title: "학교종" });
  const sounded = score.notes.filter((n) => n.midi !== null);

  it("음 높이와 길이를 복원", () => {
    expect(sounded.map((n) => n.midi)).toEqual(melody.map(([m]) => m));
    expect(sounded.map((n) => n.durationBeats)).toEqual(melody.map(([, b]) => b));
  });
  it("C장조 추정 + 4마디 코드", () => {
    expect(score.key).toMatchObject({ tonic: 0, mode: "major", fifths: 0 });
    expect(score.chords).toHaveLength(4);
    expect(score.chords[0].symbol).toBe("C");
    // 마지막 마디(레 3박 + 도 1박)는 마디당 코드 1개 규칙상 Dm/G/C 중 하나면 정상
    expect(["Dm", "G", "C"]).toContain(score.chords[3].symbol);
    expect(score.chords.every((c) => ["C", "Dm", "Em", "F", "G", "Am"].includes(c.symbol))).toBe(true);
  });
  it("음정 오차가 작음", () => expect(meanAbsCents).toBeLessThan(15));

  it("전조: C → G(+7) → 조표 1#, 코드도 이동", () => {
    expect(transposeKey(score.key, 7)).toMatchObject({ tonic: 7, fifths: 1 });
    expect(transposeKey(score.key, 3).fifths).toBe(-3); // Eb
    expect(transposeChordSymbol("F#m7/A", 2, false)).toBe("G#m7/B");
    expect(transposeChordSymbol("Am", 1, true)).toBe("Bbm");
  });

  it("MusicXML: 리드시트·피아노 대보표", () => {
    const lead = scoreToMusicXML({ ...score, transpose: 7 }, "lead");
    expect(lead).toContain("<fifths>1</fifths>");
    expect(lead.match(/<measure /g)).toHaveLength(4);
    expect(lead).toContain("<root-step>G</root-step>");
    const piano = scoreToMusicXML(score, "piano");
    expect(piano).toContain('<part id="P2">');
    expect(piano).toContain("<group-symbol>brace</group-symbol>");
    expect(piano).toContain("<chord/>");
  });

  it("MIDI: 멜로디 + 코드 트랙, 악기 지정", () => {
    const bytes = scoreToMidi({ ...score, transpose: 2 }, { melodyInstrument: "flute" });
    const parsed = new Midi(bytes);
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks[0].instrument.number).toBe(73);
    expect(parsed.tracks[0].notes[0].midi).toBe(69); // G4 + 2
  });
});

describe("템포가 바뀌어도 반복음 분리", () => {
  it.each([72, 96, 120, 140])("%i BPM", (tempo) => {
    const melody: [number, number][] = [[67, 1], [67, 1], [69, 1], [69, 1], [67, 1], [67, 1], [64, 2]];
    const { score } = buildScoreFromFrames(hum(melody, tempo), { bpm: tempo, beatsPerMeasure: 4 });
    expect(score.notes.filter((n) => n.midi !== null).map((n) => [n.midi, n.durationBeats])).toEqual(melody);
  });
});

describe("마디를 넘는 음은 붙임줄", () => {
  it("3박 음이 마디 경계를 넘으면 tie", () => {
    const { score } = buildScoreFromFrames(hum([[null, 3], [64, 3], [62, 2]], 90), { bpm: 90, beatsPerMeasure: 4 });
    const xml = scoreToMusicXML(score);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
  });
});
