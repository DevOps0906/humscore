import { describe, expect, it } from "vitest";
import { appendNote } from "../edit";
import {
  keysCanAppend,
  keysPreviewMinMeasures,
  keysShowsScore,
  keysToggleInput,
  type KeysScorePhase,
} from "../keys-entry";
import { scoreToMusicXML } from "../musicxml";
import { makeScore } from "./helpers";

const finalBar = '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
const measureCount = (xml: string) => (xml.match(/<measure /g) ?? []).length;

describe("건반 악보 마치기와 편집 재개", () => {
  it.each<KeysScorePhase>(["input", "edit"])("%s 단계만 음표를 추가할 수 있다", (phase) => {
    expect(keysCanAppend(phase)).toBe(true);
  });

  it.each<KeysScorePhase>(["idle", "done"])("%s 단계에서는 건반을 눌러도 입력하지 않는다", (phase) => {
    expect(keysCanAppend(phase)).toBe(false);
  });

  it("입력을 끄면 악보를 숨기지 않고 완료 상태로 남긴다", () => {
    const phase = keysToggleInput("input");
    expect(phase).toBe("done");
    expect(keysShowsScore(phase)).toBe(true);
    expect(keysShowsScore("idle")).toBe(false);
  });

  it("한 마디 미만 입력 후 마치면 8마디 패드만 제거하고 마지막에 마침줄을 넣는다", () => {
    const notes = appendNote([], 60, 1);
    const before = structuredClone(notes);
    const score = makeScore(notes);
    const input = scoreToMusicXML(score, "lead", { minMeasures: keysPreviewMinMeasures("input") });
    const done = scoreToMusicXML(score, "lead", { minMeasures: keysPreviewMinMeasures("done") });
    expect(measureCount(input)).toBe(8);
    expect(measureCount(done)).toBe(1);
    expect(done).toContain(`${finalBar}</measure>`);
    expect(done.match(/<bar-style>light-heavy<\/bar-style>/g)).toHaveLength(1);
    expect(notes).toEqual(before);
  });

  it("마디 경계를 넘는 음과 직접 입력한 쉼표를 보존하며 남는 빈 마디만 제거한다", () => {
    const score = makeScore([
      { midi: 60, startBeat: 0, durationBeats: 3 },
      { midi: 64, startBeat: 3, durationBeats: 2 },
      { midi: null, startBeat: 5, durationBeats: 3 },
    ]);
    const before = structuredClone(score);
    const xml = scoreToMusicXML(score, "lead", { minMeasures: keysPreviewMinMeasures("done") });
    expect(measureCount(xml)).toBe(2);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(xml).toContain("<rest/>");
    expect(xml).toContain(`${finalBar}</measure>`);
    expect(score).toEqual(before);
  });

  it("편집에서 마지막 마디를 채운 뒤 다음 음을 넣으면 새 마디와 마침줄이 따라간다", () => {
    const notes = appendNote([], 60, 4);
    const one = scoreToMusicXML(makeScore(notes), "lead", { minMeasures: keysPreviewMinMeasures("edit") });
    const extended = appendNote(notes, 62, 1);
    const two = scoreToMusicXML(makeScore(extended), "lead", { minMeasures: keysPreviewMinMeasures("edit") });
    expect(measureCount(one)).toBe(1);
    expect(measureCount(two)).toBe(2);
    expect(extended[1].startBeat).toBe(4);
    expect(two.split("<measure ")[1]).not.toContain(finalBar);
    expect(two.split("<measure ")[2]).toContain(finalBar);
    expect(notes).toHaveLength(1);
  });

  it("8마디를 넘게 입력해도 종료·저장 시 실제 마디를 잘라내지 않는다", () => {
    const score = makeScore([{ midi: 60, startBeat: 0, durationBeats: 33 }]);
    const done = scoreToMusicXML(score, "lead", { minMeasures: keysPreviewMinMeasures("done") });
    const saved = scoreToMusicXML(score);
    expect(measureCount(done)).toBe(9);
    expect(measureCount(saved)).toBe(9);
    expect(saved.split("<measure ").at(-1)).toContain(finalBar);
  });

  it("기본 저장 출력도 8마디 패드 없이 사용한 마디에 마침줄을 표시한다", () => {
    const score = makeScore(appendNote([], 60, 1));
    const xml = scoreToMusicXML(score);
    expect(measureCount(xml)).toBe(1);
    expect(xml).toContain(`${finalBar}</measure>`);
  });
});
