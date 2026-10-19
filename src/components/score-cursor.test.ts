import { describe, expect, it } from "vitest";
import type { NoteEvent } from "@/lib/music/types";
import { applyEditKey, beatKey, describeInterval, describeNote, dragSteps, dragTargetMidi, hitTestMarks, noteIndexByStart, toggleDot, withBaseDuration } from "./score-cursor";

const n = (midi: number | null, startBeat: number, durationBeats: number): NoteEvent => ({ midi, startBeat, durationBeats });

describe("noteIndexByStart", () => {
  it("시작 박으로 음표 index 를 찾음(쉼표 포함, 중간·채움 조각은 없음)", () => {
    const m = noteIndexByStart([n(60, 0, 1), n(null, 1, 0.5), n(64, 1.5, 5)]);
    expect(m.get(beatKey(0))).toBe(0);
    expect(m.get(beatKey(1))).toBe(1);
    expect(m.get(beatKey(1.5))).toBe(2);
    expect(m.get(beatKey(4))).toBeUndefined(); // 마디를 넘어 이어지는 조각
    expect(m.get(beatKey(6.5))).toBeUndefined(); // 끝 이후 채움 쉼표
  });
});

describe("duration helpers", () => {
  it("점 토글/유지", () => {
    expect(toggleDot(1)).toBe(1.5);
    expect(toggleDot(1.5)).toBe(1);
    expect(toggleDot(4)).toBe(4);
    expect(withBaseDuration(1.5, 2)).toBe(3);
    expect(withBaseDuration(1.5, 4)).toBe(4);
    expect(withBaseDuration(1, 2)).toBe(2);
  });
});

describe("applyEditKey", () => {
  const notes = [n(60, 0, 1), n(62, 1, 1), n(64, 2, 1)];
  it("좌우 이동은 clamp, 선택 없으면 첫 음", () => {
    expect(applyEditKey(notes, 0, "ArrowLeft")?.sel).toBe(0);
    expect(applyEditKey(notes, 2, "ArrowRight")?.sel).toBe(2);
    expect(applyEditKey(notes, 1, "ArrowRight")?.sel).toBe(2);
    expect(applyEditKey(notes, null, "ArrowRight")?.sel).toBe(0);
    expect(applyEditKey(notes, 1, "Home")?.sel).toBe(0);
    expect(applyEditKey(notes, 1, "End")?.sel).toBe(2);
  });
  it("음높이 ±1, Shift ±12, 범위 밖은 변경 없음", () => {
    const up = applyEditKey(notes, 1, "ArrowUp")!;
    expect(up.notes![1].midi).toBe(63);
    expect(up.play).toBe(63);
    expect(applyEditKey(notes, 1, "ArrowDown", true)!.notes![1].midi).toBe(50);
    expect(applyEditKey([n(108, 0, 1)], 0, "ArrowUp")!.notes).toBeUndefined();
    expect(applyEditKey([n(null, 0, 1)], 0, "ArrowUp")!.notes).toBeUndefined();
  });
  it("숫자키로 음가 변경, 점 유지", () => {
    expect(applyEditKey(notes, 0, "2")!.notes![0].durationBeats).toBe(0.5);
    expect(applyEditKey(notes, 0, "5")!.notes![0].durationBeats).toBe(4);
    const dotted = [n(60, 0, 1.5)];
    expect(applyEditKey(dotted, 0, "4")!.notes![0].durationBeats).toBe(3);
    expect(applyEditKey(notes, 0, ".")!.notes![0].durationBeats).toBe(1.5);
  });
  it("삭제는 이전 음 선택, Enter 는 복제 후 새 음 선택", () => {
    const del = applyEditKey(notes, 2, "Backspace")!;
    expect(del.notes).toHaveLength(2);
    expect(del.sel).toBe(1);
    expect(applyEditKey([n(60, 0, 1)], 0, "Delete")!.sel).toBeNull();
    const ins = applyEditKey(notes, 0, "Enter")!;
    expect(ins.notes!.map((x) => x.midi)).toEqual([60, 60, 62, 64]);
    expect(ins.sel).toBe(1);
  });
  it("모르는 키는 null", () => {
    expect(applyEditKey(notes, 0, "x")).toBeNull();
  });
});

describe("describeNote / hitTestMarks", () => {
  it("안내문", () => {
    expect(describeNote([n(60, 0, 1), n(62, 1, 1), n(64, 2, 1)], 2, 0, false)).toBe("3번째 음표 · E4 · 4분음표");
    expect(describeNote([n(null, 0, 2)], 0, 0, false)).toBe("1번째 쉼표 · 쉼표 · 2분음표");
  });
  it("가장 가까운 음표 선택", () => {
    const marks = [
      { left: 0, top: 0, width: 10, height: 20 },
      { left: 14, top: 0, width: 10, height: 20 },
    ];
    expect(hitTestMarks(marks, 18, 10)).toBe(1);
    expect(hitTestMarks(marks, 3, 10)).toBe(0);
    expect(hitTestMarks(marks, 200, 10)).toBeNull();
  });
});

describe("describeInterval / drag", () => {
  const key = { fifths: 0, mode: "major" as const };
  it("앞 음과의 음정", () => {
    expect(describeInterval([n(60, 0, 1), n(64, 1, 1)], 1, 0, key)).toBe("앞 음과 장3도 ↑");
    expect(describeInterval([n(64, 0, 1), n(60, 1, 1)], 1, 0, key)).toBe("앞 음과 장3도 ↓");
    expect(describeInterval([n(60, 0, 1), n(60, 1, 1)], 1, 0, key)).toBe("앞 음과 완전1도");
    expect(describeInterval([n(60, 0, 1)], 0, 0, key)).toBeNull();
    expect(describeInterval([n(null, 0, 1), n(60, 1, 1)], 1, 0, key)).toBeNull();
    expect(describeInterval([n(60, 0, 1), n(null, 1, 1)], 1, 0, key)).toBeNull();
  });
  it("드래그 단계", () => {
    expect(dragSteps(100, 78)).toBe(2);
    expect(dragSteps(100, 124)).toBe(-2);
    expect(dragSteps(100, 103)).toBe(0);
    expect(dragTargetMidi(60, 2)).toBe(62);
    expect(dragTargetMidi(108, 5)).toBe(108);
  });
});
