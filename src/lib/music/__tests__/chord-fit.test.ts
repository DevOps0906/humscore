import { describe, expect, it } from "vitest";
import { chordChangeMisfits, chordTones, describeMisfit, fittingPitchClasses, misfitsInRange, noteFitsChord, substituteChords } from "../chord-fit";

const n = (midi: number | null, startBeat: number, durationBeats = 1) => ({ midi, startBeat, durationBeats });

describe("코드와 음의 어울림", () => {
  it("구성음과 대리코드 구성음, 9도·6도는 어울린다", () => {
    expect(chordTones("C").sort((a, b) => a - b)).toEqual([0, 4, 7]);
    // C: 구성음 C E G, 대리 Am7(A C E G)·Em7(E G B D), 색깔 D(9)·A(6)
    for (const midi of [60, 64, 67, 69, 71, 62]) expect(noteFitsChord(midi, "C")).toBe(true);
    // F(5)와 C#(1)·G#(8)·A#(10)은 C와 부딪친다
    for (const midi of [65, 61, 68, 70]) expect(noteFitsChord(midi, "C")).toBe(false);
  });

  it("도미넌트 7은 트라이톤 대리(♭II7)와 ii m7 구성음까지 허용한다", () => {
    expect(substituteChords("G7")).toEqual(["C#7", "Dm7"]);
    expect(fittingPitchClasses("G7").has(1)).toBe(true); // C#
    expect(fittingPitchClasses("G7").has(0)).toBe(true); // C (Dm7의 7음)
  });

  it("단조 코드는 relative major 대리를 허용한다", () => {
    expect(substituteChords("Am")).toEqual(["Cmaj7", "Fmaj7"]);
    expect(noteFitsChord(71, "Am")).toBe(true); // B = 9도 / Cmaj7
  });

  it("마이너 코드 위의 4도음(11도)은 어울린다", () => {
    expect(noteFitsChord(62, "Am")).toBe(true); // D
    expect(noteFitsChord(61, "Am")).toBe(false); // C#
  });

  it("알 수 없는 기호는 대리코드가 없다", () => {
    expect(substituteChords("???")).toEqual([]);
  });

  it("구간 첫 음·강박·긴 음만 따지고 짧은 경과음은 넘어간다", () => {
    const notes = [n(60, 0), n(65, 1, 0.5), n(64, 1.5, 0.5), n(65, 2, 1)];
    const hits = misfitsInRange(notes, "C", 0, 4);
    // F(65)가 1박 약박 짧은 음이면 통과, 2박 강박(1박 길이)이면 부조화
    expect(hits.map((hit) => hit.note.startBeat)).toEqual([2]);
  });

  it("쉼표와 구간 밖의 음은 보지 않는다", () => {
    expect(misfitsInRange([n(null, 0), n(65, 4)], "C", 0, 4)).toEqual([]);
  });
});

describe("코드를 바꿀 때의 부조화", () => {
  const score = { beatsPerMeasure: 4, notes: [n(60, 0, 2), n(64, 2, 2), n(65, 4, 4)], chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "F" }] };

  it("어울리는 코드로 바꾸면 질문하지 않는다", () => {
    expect(chordChangeMisfits(score, [{ startBeat: 0, symbol: "Am" }, { startBeat: 4, symbol: "F" }])).toEqual([]);
  });

  it("멜로디와 부딪치는 코드는 해당 음을 알려 준다", () => {
    const misfits = chordChangeMisfits(score, [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "C" }]);
    expect(misfits).toHaveLength(1);
    expect(misfits[0].note.midi).toBe(65);
    expect(describeMisfit(misfits[0], 4)).toBe("2마디 1박 F음 · C 코드");
  });

  it("바뀌지 않은 코드의 기존 부조화는 다시 묻지 않는다", () => {
    const clash = { ...score, chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "C" }] };
    expect(chordChangeMisfits(clash, clash.chords)).toEqual([]);
  });

  it("코드를 새로 붙이거나 위치를 옮겨도 그 구간을 검사한다", () => {
    const misfits = chordChangeMisfits(score, [{ startBeat: 0, symbol: "C" }, { startBeat: 2, symbol: "F" }, { startBeat: 4, symbol: "F" }]);
    // 2박부터 F: E(64)는 F의 대리(Dm7 등)엔 없지만 Am7·Em7 영역... F maj 대리 Dm7(D F A C)과 Am7(A C E G)에 E가 있다
    expect(misfits).toEqual([]);
  });
});
