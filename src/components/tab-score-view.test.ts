import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TabScoreView } from "./tab-score-view";
import { createBlankScore } from "@/lib/music/edit";
import type { Score } from "@/lib/music/types";

const render = (score: Score, instrument: "acousticGuitar" | "bassGuitar" = "acousticGuitar") =>
  renderToStaticMarkup(createElement(TabScoreView, { score, instrument }));

describe("TAB 악보 카드", () => {
  it("마디를 넘는 음은 계속 음과 구간 길이를 표시하고 쉼으로 바꾸지 않는다", () => {
    const score = { ...createBlankScore(), notes: [{ midi: 64, startBeat: 0, durationBeats: 6 }] };
    const html = render(score);
    expect(html.match(/data-testid="tab-note"/g)).toHaveLength(2);
    expect(html).toContain("앞 마디에서 이어짐");
    expect(html).toContain("4박");
    expect(html).toContain("2박");
    expect(html).not.toContain(">쉼<");
  });

  it("베이스 범위 밖 음과 쉼표는 서로 다르게 안내한다", () => {
    const score = { ...createBlankScore(), notes: [
      { midi: 88, startBeat: 0, durationBeats: 1 },
      { midi: null, startBeat: 1, durationBeats: 1 },
    ] };
    const html = render(score, "bassGuitar");
    expect(html).toContain("4현 표준 튜닝");
    expect(html).toContain("연주 범위 밖 음표 1개");
    expect(html).toContain(">×<");
    expect(html).toContain(">쉼<");
  });

  it("다섯 마디는 두 줄이며 전조는 표시만 바꾸고 원본을 유지한다", () => {
    const score = { ...createBlankScore(), transpose: 2, notes: [{ midi: 40, startBeat: 16, durationBeats: 1 }], chords: [{ startBeat: 16, symbol: "C" }] };
    const before = JSON.stringify(score);
    const html = render(score);
    expect(html.match(/data-testid="tab-system"/g)).toHaveLength(2);
    expect(html.match(/data-testid="tab-measure"/g)).toHaveLength(5);
    expect(html).toContain("F#2");
    expect(html).toContain(">D<");
    expect(JSON.stringify(score)).toBe(before);
  });
});
