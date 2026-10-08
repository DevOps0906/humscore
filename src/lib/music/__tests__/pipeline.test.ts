import { describe, expect, it } from "vitest";
import { buildScoreFromFrames } from "../pipeline";
import { scoreToMusicXML } from "../musicxml";
import { totalBeats } from "../quantize";
import { frames, hum } from "./helpers";

const base = { bpm: 120, beatsPerMeasure: 4 };

describe("buildScoreFromFrames", () => {
  it("빈 입력 -> 한 마디 쉼표 악보, 예외 없음", () => {
    const { score, raw, meanAbsCents } = buildScoreFromFrames([], base);
    expect(raw).toEqual([]);
    expect(meanAbsCents).toBe(0);
    expect(score.notes).toEqual([{ midi: null, startBeat: 0, durationBeats: 4 }]);
    expect(score.chords).toHaveLength(1);
    expect(score.key).toEqual({ tonic: 0, mode: "major", fifths: 0 });
    expect(score.transpose).toBe(0);
  });
  it("전부 무음 프레임", () => {
    const { score } = buildScoreFromFrames(frames(Array(60).fill(null)), base);
    expect(score.notes.every((x) => x.midi === null)).toBe(true);
  });
  it("프레임 1~2개(짧음) -> 음 없음", () => {
    expect(buildScoreFromFrames(frames([60]), base).score.notes.every((x) => x.midi === null)).toBe(true);
    expect(buildScoreFromFrames(frames([60, 60]), base).score.notes.every((x) => x.midi === null)).toBe(true);
  });
  it("메타데이터: 제목, bpm, 박자, 타임스탬프, id", () => {
    const { score } = buildScoreFromFrames([], { ...base, title: "제목", bpm: 90, beatsPerMeasure: 3 });
    expect(score).toMatchObject({ title: "제목", bpm: 90, beatsPerMeasure: 3, beatUnit: 4 });
    expect(score.id.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(score.createdAt))).toBe(false);
    expect(score.createdAt).toBe(score.updatedAt);
  });
  it("제목 생략 시 기본 제목", () => {
    expect(buildScoreFromFrames([], base).score.title.length).toBeGreaterThan(0);
  });
  it("호출마다 id 다름", () => {
    expect(buildScoreFromFrames([], base).score.id).not.toBe(buildScoreFromFrames([], base).score.id);
  });
  it("음 앞 쉼표 + 일반 허밍 (end-to-end)", () => {
    const { score } = buildScoreFromFrames(hum([[null, 2], [60, 1], [62, 1], [64, 2], [60, 2]], 120), base);
    expect(score.notes[0]).toMatchObject({ midi: null, startBeat: 0, durationBeats: 2 });
    expect(score.notes.filter((x) => x.midi !== null).map((x) => x.midi)).toEqual([60, 62, 64, 60]);
    expect(totalBeats(score.notes) % 4).toBe(0);
  });
  it("노트가 겹치거나 빈틈 없이 연속 (startBeat 누적 일치)", () => {
    const { score } = buildScoreFromFrames(hum([[67, 1], [67, 1], [69, 2], [null, 1], [64, 3]], 100), { ...base, bpm: 100 });
    let cursor = 0;
    for (const x of score.notes) {
      expect(x.startBeat).toBeCloseTo(cursor, 6);
      cursor += x.durationBeats;
    }
  });
  it("3/4 박자 마디 길이", () => {
    const { score } = buildScoreFromFrames(hum([[60, 1], [62, 1], [64, 1], [65, 1]], 120), { ...base, beatsPerMeasure: 3 });
    expect(totalBeats(score.notes) % 3).toBe(0);
    expect(score.chords).toHaveLength(totalBeats(score.notes) / 3);
  });
  it("grid=0.25 (16분음표) 옵션", () => {
    const { score } = buildScoreFromFrames(hum([[60, 0.75], [62, 1.25], [64, 2]], 120), { ...base, grid: 0.25 });
    const d = score.notes.filter((x) => x.midi !== null).map((x) => x.durationBeats);
    expect(d[0]).toBeCloseTo(0.75, 6);
  });
  it("segment 옵션 전달 (minClarity 올리면 음 사라짐)", () => {
    const f = hum([[60, 2]], 120);
    const { score } = buildScoreFromFrames(f, { ...base, segment: { minClarity: 0.99 } });
    expect(score.notes.every((x) => x.midi === null)).toBe(true);
  });
  it("높은 음정 정확도 -> meanAbsCents 작음 / 크게 어긋난 음정 -> 큼", () => {
    const good = buildScoreFromFrames(hum([[60, 2]], 120, 0), base).meanAbsCents;
    const bad = buildScoreFromFrames(hum([[60, 2]], 120, 40), base).meanAbsCents;
    expect(good).toBeLessThan(1);
    expect(bad).toBeGreaterThanOrEqual(good);
  });
  it("end-to-end: 결과 Score 가 MusicXML 로 변환 가능", () => {
    const { score } = buildScoreFromFrames(hum([[60, 1], [64, 1], [67, 2], [60, 4]], 120), base);
    const xml = scoreToMusicXML(score, "piano");
    expect(xml.match(/<measure /g)).toHaveLength(score.chords.length);
  });
});
