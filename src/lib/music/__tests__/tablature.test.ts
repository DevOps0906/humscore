import { describe, expect, it } from "vitest";
import { GUITAR_TUNINGS, guitarPositions, isGuitarInstrument, scoreToTab } from "../tablature";
import { makeScore } from "./helpers";

describe("기타 TAB 변환", () => {
  it("기타는 6줄, 베이스는 4줄의 높은 줄부터 표준 조율이다", () => {
    expect(GUITAR_TUNINGS.classicalGuitar).toEqual([64, 59, 55, 50, 45, 40]);
    expect(GUITAR_TUNINGS.acousticGuitar).toEqual(GUITAR_TUNINGS.electricGuitar);
    expect(GUITAR_TUNINGS.bassGuitar).toEqual([43, 38, 33, 28]);
    expect(isGuitarInstrument("piano")).toBe(false);
    expect(isGuitarInstrument("toString")).toBe(false);
    expect(isGuitarInstrument(null)).toBe(false);
    for (const id of Object.keys(GUITAR_TUNINGS)) expect(isGuitarInstrument(id)).toBe(true);
  });

  it("개방현과 24프렛 경계를 포함하고 음높이를 바꾸지 않는다", () => {
    expect(guitarPositions(40, "acousticGuitar")).toEqual([{ string: 6, fret: 0 }]);
    expect(guitarPositions(88, "electricGuitar")).toEqual([{ string: 1, fret: 24 }]);
    expect(guitarPositions(39, "classicalGuitar")).toEqual([]);
    expect(guitarPositions(89, "acousticGuitar")).toEqual([]);
    expect(guitarPositions(28, "bassGuitar")).toEqual([{ string: 4, fret: 0 }]);
    expect(guitarPositions(27, "bassGuitar")).toEqual([]);
    expect(guitarPositions(64, "classicalGuitar", 0)).toEqual([{ string: 1, fret: 0 }]);
    expect(guitarPositions(64.5, "classicalGuitar")).toEqual([]);
    expect(guitarPositions(NaN, "classicalGuitar")).toEqual([]);
    expect(guitarPositions(64, "classicalGuitar", -1)).toEqual([]);
  });

  it("전조한 실제 음높이를 보존하고 원본 악보는 바꾸지 않는다", () => {
    const score = makeScore([
      { midi: 39, startBeat: 0, durationBeats: 1 },
      { midi: null, startBeat: 1, durationBeats: 0.5 },
      { midi: 88, startBeat: 1.5, durationBeats: 2.5 },
    ], { transpose: 1 });
    const original = JSON.stringify(score);
    const tab = scoreToTab(score, "classicalGuitar");
    expect(tab[0]).toEqual({ noteIndex: 0, startBeat: 0, durationBeats: 1, midi: 40, string: 6, fret: 0, unplayable: false });
    expect(tab[1]).toEqual({ noteIndex: 1, startBeat: 1, durationBeats: 0.5, midi: null, string: null, fret: null, unplayable: false });
    expect(tab[2]).toEqual({ noteIndex: 2, startBeat: 1.5, durationBeats: 2.5, midi: 89, string: null, fret: null, unplayable: true });
    expect(JSON.stringify(score)).toBe(original);
  });

  it("다음 음까지 고려해 같은 줄의 가까운 프렛으로 움직인다", () => {
    const score = makeScore([64, 63, 62].map((midi, startBeat) => ({ midi, startBeat, durationBeats: 1 })));
    const tab = scoreToTab(score, "acousticGuitar");
    expect(tab.map(({ string, fret }) => ({ string, fret }))).toEqual([
      { string: 2, fret: 5 }, { string: 2, fret: 4 }, { string: 2, fret: 3 },
    ]);
  });

  it("음표 저장 순서가 달라도 시간순으로 운지를 고르고 원본 순서를 반환한다", () => {
    const score = makeScore([
      { midi: 62, startBeat: 2, durationBeats: 1 },
      { midi: 64, startBeat: 0, durationBeats: 1 },
      { midi: 63, startBeat: 1, durationBeats: 1 },
    ]);
    expect(scoreToTab(score, "acousticGuitar").map((note) => [note.noteIndex, note.startBeat, note.fret])).toEqual([[0, 2, 3], [1, 0, 5], [2, 1, 4]]);
    expect(scoreToTab(makeScore([]), "bassGuitar")).toEqual([]);
  });
});
