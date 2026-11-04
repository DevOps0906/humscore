import { describe, expect, it } from "vitest";
import { ACOUSTIC_PIANOS, CREATION_MODES, ELECTRIC_PIANOS, GM_INSTRUMENTS, GUITAR_INSTRUMENTS, INSTRUMENT_LABELS, INSTRUMENT_ORDER, ORCHESTRA_GROUPS, SYNTH_INSTRUMENTS, instrumentMode, isCreationMode, isInstrumentId } from "../instrument-catalog";

describe("악보 방식과 음색 카탈로그", () => {
  it("네 가지 생성 방식과 일렉피아노 10종을 제공한다", () => {
    expect(CREATION_MODES.map((mode) => mode.id)).toEqual(["piano", "guitarTab", "drums", "orchestra"]);
    expect(ELECTRIC_PIANOS).toHaveLength(10);
    expect(new Set(ELECTRIC_PIANOS).size).toBe(10);
    expect(ACOUSTIC_PIANOS).toContain("piano");
    expect(SYNTH_INSTRUMENTS).toEqual(expect.arrayContaining(["synthLead", "warmPad", "shimmerPad", "synthArp"]));
  });

  it("선택 가능한 세부 악기는 유효한 GM 번호와 한국어 라벨을 가진다", () => {
    const selected = [...ACOUSTIC_PIANOS, ...ELECTRIC_PIANOS, ...SYNTH_INSTRUMENTS, ...GUITAR_INSTRUMENTS, ...ORCHESTRA_GROUPS.flatMap((group) => group.instruments)];
    for (const instrument of selected) {
      expect(isInstrumentId(instrument)).toBe(true);
      expect(INSTRUMENT_ORDER).toContain(instrument);
      expect(INSTRUMENT_LABELS[instrument]).toMatch(/[가-힣]/);
      expect(GM_INSTRUMENTS[instrument]).toBeGreaterThanOrEqual(0);
      expect(GM_INSTRUMENTS[instrument]).toBeLessThanOrEqual(127);
    }
    expect(new Set(INSTRUMENT_ORDER).size).toBe(INSTRUMENT_ORDER.length);
    expect(isInstrumentId("toString")).toBe(false);
    expect(isInstrumentId(null)).toBe(false);
    expect(isCreationMode("piano")).toBe(true);
    expect(isCreationMode("unknown")).toBe(false);
  });

  it("음색만 있는 구버전 설정도 적절한 생성 방식으로 해석한다", () => {
    expect(instrumentMode("epRhodes")).toBe("piano");
    expect(instrumentMode("bassGuitar5")).toBe("guitarTab");
    expect(instrumentMode("drumKit")).toBe("drums");
    expect(instrumentMode("bassoon")).toBe("orchestra");
    expect(ORCHESTRA_GROUPS.map((group) => group.id)).toEqual(expect.arrayContaining(["strings", "woodwinds", "brass", "timpani", "harp"]));
  });
});
