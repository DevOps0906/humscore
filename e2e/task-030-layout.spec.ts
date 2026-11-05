import { expect, test } from "./fixtures";
import { buildScoreTemplate } from "../src/lib/music/score-templates";

const id = "ed93cf43-0a16-419f-b624-270f68a61f92";

for (const width of [390, 900, 1440]) for (const count of [5, 8, 9]) test(`${width}px ${count}마디는 음표 밀도와 관계없이 마디선이 정렬된다`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/library");
  const notes = Array.from({ length: count }, (_, measure) => {
    const density = [4, 16, 2, 8][measure % 4];
    return Array.from({ length: density }, (_, index) => ({ midi: 60 + index % 5, startBeat: measure * 4 + index * 4 / density, durationBeats: 4 / density }));
  }).flat();
  const score = {
    ...buildScoreTemplate({ template: "piano", instruments: ["piano"], title: "마디 정렬 검사", bpm: 90, meter: "4/4", measures: count, tonic: 0 }),
    id, notes, chords: [], accompaniment: undefined,
  };
  await page.evaluate((value) => localStorage.setItem("humscore.scores.v1", JSON.stringify([value])), score);
  await page.goto(`/scores/${id}`);
  const sheet = page.locator(".score-sheet:visible").first();
  await expect(sheet.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await expect(sheet.locator(".vf-measure")).toHaveCount(count);
  const boxes = await sheet.locator(".vf-measure").evaluateAll((elements) => elements.map((element) => {
    const rect = element.querySelector(":scope > path")!.getBoundingClientRect();
    return { x: rect.x, right: rect.right, width: rect.width };
  }));
  for (let index = 0; index < count; index++) {
    expect(Math.abs(boxes[index].width - boxes[0].width)).toBeLessThan(0.5);
    expect(Math.abs(boxes[index].x - boxes[index % 4].x)).toBeLessThan(0.5);
    expect(Math.abs(boxes[index].right - boxes[index % 4].right)).toBeLessThan(0.5);
  }
  const margin = await sheet.locator("svg").first().evaluate((svg) => {
    const paper = svg.getBoundingClientRect();
    const first = svg.querySelector(".vf-measure > path")!.getBoundingClientRect();
    const right = Math.max(...Array.from(svg.querySelectorAll(".vf-measure > path")).map((path) => path.getBoundingClientRect().right));
    return { left: (first.left - paper.left) / paper.width, right: (paper.right - right) / paper.width };
  });
  expect(margin.left).toBeGreaterThan(0.065);
  expect(margin.left).toBeLessThan(0.085);
  expect(margin.right).toBeGreaterThan(0.065);
  expect(margin.right).toBeLessThan(0.085);
});

for (const width of [390, 900, 1440]) test(`${width}px SATB 가사와 글꼴 크기를 바꿔도 모든 성부 마디선이 정렬된다`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/library");
  const score = { ...buildScoreTemplate({ template: "hymn", instruments: ["choir"], title: "성부 정렬 검사", bpm: 76, meter: "4/4", measures: 8, tonic: 0, previewSample: true }), id };
  for (const size of [14, 18]) {
    await page.evaluate((value) => localStorage.setItem("humscore.scores.v1", JSON.stringify([value])), { ...score, headerFont: "classic-serif", headerFontSize: size, headerFontWeight: 800 });
    await page.goto(`/scores/${id}`);
    const output = page.locator(".score-export");
    await expect(output.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    await expect(output.locator(".vf-measure")).toHaveCount(32);
    const positions = await output.locator(".vf-measure").evaluateAll((elements) => elements.map((element) => {
      const rect = element.querySelector(":scope > path")!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width };
    }));
    const left = Math.min(...positions.map((position) => position.x));
    const slot = positions[0].width;
    for (const position of positions) {
      expect(Math.abs(position.width - slot)).toBeLessThan(0.5);
      const column = Math.round((position.x - left) / slot);
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(4);
      expect(Math.abs(position.x - left - column * slot)).toBeLessThan(0.5);
    }
    const title = output.locator("svg text").filter({ hasText: /^성부 정렬 검사$/ });
    await expect(title).toHaveAttribute("font-weight", "800");
    await expect(title).toHaveAttribute("font-family", /Times New Roman/);
    await page.screenshot({ path: `.nomad/task-030/${width}-satb-${size}.png`, fullPage: true });
  }
});
