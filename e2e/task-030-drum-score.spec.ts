import { expect, test } from "./fixtures";
import { buildScoreTemplate } from "../src/lib/music/score-templates";

for (const width of [390, 900, 1440]) test(`${width}px 8비트 드럼 악보의 손·발과 동시 타격을 출력한다`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: 1000 });
  const score = buildScoreTemplate({ template: "drums", instruments: ["drumKit"], title: "드럼 리듬 · 8비트와 필인", bpm: 96, meter: "4/4", measures: 8, tonic: 0, previewSample: true });
  await page.goto("/library");
  await page.evaluate((score) => localStorage.setItem("humscore.scores.v1", JSON.stringify([score])), score);
  await page.goto(`/scores/${score.id}`);
  const sheet = page.locator(".score-sheet:visible");
  await expect(sheet.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await expect(sheet.locator(".vf-measure")).toHaveCount(8);
  // VexFlow는 쉼표도 vf-notehead 안에 그린다. 실제 타격 수 보존은 XML 단위 검사에서 확인한다.
  expect(await sheet.locator(".vf-notehead").count()).toBeGreaterThanOrEqual(score.notes.length);
  expect(await sheet.locator(".vf-beam").count()).toBeGreaterThan(0);
  const rows = await sheet.locator(".vf-measure").evaluateAll((measures) => measures.map((measure) => {
    const box = measure.querySelector(":scope > path")!.getBoundingClientRect();
    return { x: box.x, width: box.width };
  }));
  for (let column = 0; column < 4; column++) {
    expect(Math.abs(rows[column].x - rows[column + 4].x)).toBeLessThan(1);
    expect(Math.abs(rows[column].width - rows[column + 4].width)).toBeLessThan(1);
  }
  await sheet.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.nomad/task-030/${width}-drum-score.png`, fullPage: true });
  if (width === 1440) await page.pdf({ path: ".nomad/task-030/drum-score-a4.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
});
