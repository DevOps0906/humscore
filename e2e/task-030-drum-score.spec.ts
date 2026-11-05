import { expect, test } from "./fixtures";
import { buildScoreTemplate } from "../src/lib/music/score-templates";

for (const width of [390, 900, 1440]) test(`${width}px 8비트 드럼 악보의 손·발과 동시 타격을 출력한다`, async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: 1000 });
  const score = buildScoreTemplate({ template: "drums", instruments: ["drumKit"], title: "드럼 리듬 · 8비트와 필인", bpm: 96, meter: "4/4", measures: 20, tonic: 0, previewSample: true });
  await page.goto("/library");
  await page.evaluate((score) => localStorage.setItem("humscore.scores.v1", JSON.stringify([score])), score);
  await page.goto(`/scores/${score.id}`);
  const sheet = page.locator(".score-sheet:visible");
  // 20마디의 촘촘한 드럼 악보는 좁은 화면에서 다시 그리는 데 시간이 걸린다
  await expect(sheet.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
  await expect(sheet.locator(".vf-measure")).toHaveCount(20, { timeout: 30_000 });
  // VexFlow는 쉼표도 vf-notehead 안에 그린다. 실제 타격 수 보존은 XML 단위 검사에서 확인한다.
  expect(await sheet.locator(".vf-notehead").count()).toBeGreaterThanOrEqual(score.notes.length);
  expect(await sheet.locator(".vf-beam").count()).toBeGreaterThan(0);
  const rows = await sheet.locator(".vf-measure").evaluateAll((measures) => measures.map((measure) => {
    const box = measure.querySelector(":scope > path")!.getBoundingClientRect();
    return { x: box.x, width: box.width };
  }));
  // 4마디씩 5줄: 첫 줄은 이름(Drumset)이 길어 조금 좁고, 나머지 줄(Drs.)은 x·폭이 같다
  for (let column = 0; column < 4; column++) {
    for (let line = 2; line < 5; line++) {
      expect(Math.abs(rows[column + 4].x - rows[column + line * 4].x)).toBeLessThan(1.5);
      expect(Math.abs(rows[column + 4].width - rows[column + line * 4].width)).toBeLessThan(1.5);
    }
  }
  // 첫 줄은 Drumset, 다음 줄부터는 Drs. 이름과 줄 시작 마디 번호가 붙는다
  await expect(sheet.locator("svg text").filter({ hasText: /^Drumset$/ })).toHaveCount(1);
  expect(await sheet.locator("svg text").filter({ hasText: /^Drs\.$/ }).count()).toBe(4);
  await sheet.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.nomad/task-030/${width}-drum-score.png`, fullPage: true });
  if (width === 1440) await page.pdf({ path: ".nomad/task-030/drum-score-a4.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
});
