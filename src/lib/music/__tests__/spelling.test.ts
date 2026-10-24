import { describe, expect, it } from "vitest";
import { AccidentalTracker, intervalName, spellPitch } from "../spelling";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";
import type { KeyInfo, NoteEvent } from "../types";

const K = (fifths: number, mode: "major" | "minor" = "major"): KeyInfo => ({
  tonic: (((fifths * 7) % 12) + 12 + (mode === "minor" ? 9 : 0)) % 12,
  mode,
  fifths,
});
const sp = (midi: number, key: KeyInfo, next?: number | null) => {
  const s = spellPitch(midi, key, { next });
  return `${s.step}${s.alter === 1 ? "#" : s.alter === -1 ? "b" : ""}${s.octave}`;
};
const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("spellPitch", () => {
  it("음계음은 조의 철자: F#장조의 E#, Gb장조의 Cb, a단조 화성 7음 G#, C#장조의 B#", () => {
    expect(sp(65, K(6))).toBe("E#4");
    expect(sp(71, K(-6))).toBe("Cb5");
    expect(sp(68, K(0, "minor"))).toBe("G#4");
    expect(sp(60, K(7))).toBe("B#3");
    expect(sp(61, K(7))).toBe("C#4");
    expect(sp(70, K(-2))).toBe("Bb4");
  });
  it("음계 밖 검은건반: 위로 진행하면 #, 아래로 진행하면 b", () => {
    expect(sp(61, K(0), 62)).toBe("C#4");
    expect(sp(63, K(0), 64)).toBe("D#4");
    expect(sp(63, K(0), 62)).toBe("Eb4");
    expect(sp(66, K(-1), 65)).toBe("Gb4");
  });
  it("다음 음이 없거나 같으면 조 방향, C/Am 기본은 C# Eb F# Ab Bb", () => {
    expect(sp(66, K(2))).toBe("F#4"); // D장조 안
    expect(sp(70, K(1))).toBe("A#4");
    expect(sp(70, K(-1), 70)).toBe("Bb4");
    expect([61, 63, 66, 68, 70].map((m) => sp(m, K(0)))).toEqual(["C#4", "Eb4", "F#4", "Ab4", "Bb4"]);
    expect(sp(63, K(0), null)).toBe("Eb4");
  });
  it("음계 밖 흰건반은 제자리음, 옥타브 번호가 올바름", () => {
    expect(sp(65, K(1))).toBe("F4");
    expect(sp(71, K(-6))).toBe("Cb5");
  });
  it("겹임시표는 만들지 않음 (모든 조 x 모든 음)", () => {
    for (let f = -7; f <= 7; f++)
      for (const mode of ["major", "minor"] as const)
        for (let m = 21; m <= 108; m++) {
          expect(Math.abs(spellPitch(m, K(f, mode), { next: m + 1 }).alter)).toBeLessThanOrEqual(1);
          expect(Math.abs(spellPitch(m, K(f, mode), { next: m - 1 }).alter)).toBeLessThanOrEqual(1);
        }
  });
});

describe("임시표 (MusicXML accidental)", () => {
  const acc = (xml: string) => [...xml.matchAll(/<accidental>([\w-]+)<\/accidental>/g)].map((x) => x[1]);
  it("조표 안의 음은 임시표 없음 (G장조 F#)", () => {
    expect(acc(scoreToMusicXML(makeScore([n(66, 0, 4)], { key: K(1) })))).toEqual([]);
  });
  it("조표 밖 음: 같은 마디 반복은 한 번만, 제자리표 복귀 표시, 마디선 뒤 초기화", () => {
    const xml = scoreToMusicXML(makeScore([n(61, 0, 1), n(61, 1, 1), n(60, 2, 1), n(60, 3, 1), n(61, 4, 4)]));
    expect(acc(xml)).toEqual(["sharp", "natural", "sharp"]);
  });
  it("조표 음을 제자리로 바꾸면 제자리표, 다시 올리면 올림표, 또 제자리면 제자리표", () => {
    const xml = scoreToMusicXML(makeScore([n(65, 0, 1), n(66, 1, 1), n(66, 2, 1), n(65, 3, 1)], { key: K(1) }));
    expect(acc(xml)).toEqual(["natural", "sharp", "natural"]);
  });
  it("다른 옥타브는 따로 취급", () => {
    expect(acc(scoreToMusicXML(makeScore([n(61, 0, 2), n(73, 2, 2)])))).toEqual(["sharp", "sharp"]);
  });
  it("마디선을 넘어 붙임줄로 이어지는 음은 임시표 반복 안 함", () => {
    const xml = scoreToMusicXML(makeScore([n(null, 0, 3), n(61, 3, 3), n(null, 6, 2)]));
    expect(acc(xml)).toEqual(["sharp"]);
    expect(count(xml, /<tie type="stop"\/>/g)).toBe(1);
  });
  it("피아노 왼손은 자체 상태 (멜로디 임시표와 독립)", () => {
    const xml = scoreToMusicXML(makeScore([n(66, 0, 4)], { chords: [{ startBeat: 0, symbol: "D" }] }), "piano");
    expect(acc(xml).filter((a) => a === "sharp").length).toBe(2); // 멜로디 F# + 왼손 F#
  });
  it("AccidentalTracker 직접", () => {
    const t = new AccidentalTracker(0);
    expect(t.next({ step: "F", alter: 1, octave: 4 })).toBe("sharp");
    expect(t.next({ step: "F", alter: 1, octave: 4 })).toBeNull();
    expect(t.next({ step: "F", alter: 0, octave: 4 })).toBe("natural");
    t.reset();
    expect(t.next({ step: "F", alter: 0, octave: 4 })).toBeNull();
  });
});

describe("MusicXML 구조", () => {
  const xml = scoreToMusicXML(
    makeScore([n(60, 0, 2.5), n(62, 2.5, 3), n(null, 5.5, 1), n(64, 6.5, 1.5)], { chords: [{ startBeat: 0, symbol: "C" }, { startBeat: 4, symbol: "G" }] }),
    "piano",
  );
  it("stem 없음, time 은 1마디에만, attributes 순서", () => {
    expect(xml).not.toContain("<stem");
    expect(count(xml, /<time>/g)).toBe(2); // 멜로디·피아노 파트 각 1마디에만
    expect(xml).toMatch(/<attributes><divisions>4<\/divisions><key>.*<\/key><time>.*<\/time><clef/);
  });
  it("마디마다 보표별 duration 합 = 박 x divisions (chord 겹음 제외)", () => {
    const [melodyPart, pianoPart] = xml.split('<part id="P2">');
    expect(pianoPart).toBeDefined();
    for (const m of melodyPart.split("<measure ").slice(1)) {
      const notes = m.match(/<note>.*?<\/note>/g) ?? [];
      const sum = (staff: number) =>
        notes
          .filter((x) => x.includes(`<staff>${staff}</staff>`) && !x.includes("<chord/>"))
          .reduce((s, x) => s + Number(/<duration>(\d+)<\/duration>/.exec(x)![1]), 0);
      expect(sum(1)).toBe(16);
    }
    for (const m of pianoPart.split("<measure ").slice(1)) {
      const notes = m.match(/<note>.*?<\/note>/g) ?? [];
      const total = notes.filter((x) => !x.includes("<chord/>")).reduce((s, x) => s + Number(/<duration>(\d+)<\/duration>/.exec(x)![1]), 0);
      expect(total).toBe(16);
    }
  });
  it("붙임줄은 tie 와 tied 가 짝", () => {
    const x = scoreToMusicXML(makeScore([n(60, 0, 2.5), n(62, 2.5, 5.5)]));
    expect(count(x, /<tie type="start"\/>/g)).toBe(count(x, /<tied type="start"\/>/g));
    expect(count(x, /<tie type="stop"\/>/g)).toBe(count(x, /<tied type="stop"\/>/g));
    expect(count(x, /<tied type="start"\/>/g)).toBeGreaterThan(0);
  });
});

describe("intervalName", () => {
  it("기본 음정", () => {
    expect(intervalName(60, 60)).toBe("완전1도");
    expect(intervalName(60, 63)).toBe("단3도");
    expect(intervalName(60, 64)).toBe("장3도");
    expect(intervalName(60, 67)).toBe("완전5도");
    expect(intervalName(60, 72)).toBe("완전8도");
    expect(intervalName(64, 65)).toBe("단2도"); // E-F
    expect(intervalName(71, 72)).toBe("단2도"); // B-C
    expect(intervalName(60, 62)).toBe("장2도");
    expect(intervalName(60, 71)).toBe("장7도");
    expect(intervalName(60, 70)).toBe("단7도");
    expect(intervalName(60, 68)).toBe("단6도");
  });
  it("C-F# 증4도 vs C-Gb 감5도 (조에 따라)", () => {
    expect(intervalName(60, 66)).toBe("증4도");
    expect(intervalName(60, 66, K(0))).toBe("증4도");
    expect(intervalName(60, 66, K(-5))).toBe("감5도");
  });
  it("복합 음정과 순서 뒤바뀐 입력", () => {
    expect(intervalName(60, 76)).toBe("장10도");
    expect(intervalName(60, 79)).toBe("완전12도");
    expect(intervalName(67, 60)).toBe("완전5도");
  });
});
