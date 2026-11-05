import { expect, openKeysInput, test } from "./fixtures";

for (const width of [390, 900, 1440]) test(`${width}px 4/4·8마디 형식과 SATB 찬송가를 미리보고 빈 악보로 보존한다`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height: 1000 });
  await openKeysInput(page);
  await page.getByRole("button", { name: "템플릿으로 시작하기", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const preview = dialog.getByRole("region", { name: "템플릿 미리보기", exact: true });
  const paper = dialog.getByTestId("template-score-preview");

  await dialog.getByRole("button", { name: /피아노 악보/ }).click();
  await expect(preview).toContainText("4/4 · 8마디");
  await expect(paper.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await expect(paper.locator(".vf-measure")).toHaveCount(16);
  const paperBox = (await paper.boundingBox())!;
  const previewBox = (await preview.boundingBox())!;
  expect(Math.abs(paperBox.x + paperBox.width / 2 - previewBox.x - previewBox.width / 2)).toBeLessThan(2);

  await dialog.getByRole("button", { name: /베이스 악보/ }).click();
  await expect(preview.getByRole("region", { name: "TAB 악보", exact: true })).toBeVisible();
  await expect(paper.getByTestId("tab-measure")).toHaveCount(8);
  await expect(paper.locator(".score-sheet")).toHaveCount(0);

  await dialog.getByRole("button", { name: /오케스트라 · 관현악/ }).click();
  await expect(preview).toContainText("4/4 · 4마디");

  await dialog.getByRole("button", { name: /^찬송가/ }).click();
  await expect(preview).toContainText("4/4 · 8마디");
  const title = paper.getByTestId("score-header").getByRole("heading", { name: "주 하나님 지으신 모든 세계", exact: true });
  await expect(title).toBeVisible();
  expect(Number(await title.evaluate((element) => getComputedStyle(element).fontWeight))).toBeGreaterThanOrEqual(700);
  await expect(paper.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  // 소프라노·알토 / 테너·베이스가 두 보표(큰보표)로 묶여 한 줄에 마디 4개씩 2줄 = 16마디
  await expect(paper.locator(".vf-measure")).toHaveCount(16);
  const scoreText = (await paper.locator("svg text").allTextContents()).join(" ");
  for (const verse of [1, 2, 3, 4]) expect(scoreText).toContain(`${verse}절`);
  await page.screenshot({ path: `.nomad/task-029/${width}-hymn-template.png`, fullPage: true });

  await dialog.getByRole("button", { name: "다음", exact: true }).click();
  await dialog.getByRole("button", { name: "다음", exact: true }).click();
  await expect(dialog.getByLabel("템플릿 박자", { exact: true })).toHaveValue("4/4");
  await expect(dialog.getByLabel("템플릿 마디 수", { exact: true })).toHaveValue("8");
  await dialog.getByRole("button", { name: "이 템플릿으로 악보 생성", exact: true }).click();
  await page.reload();
  const partButtons = page.getByRole("group", { name: "편집할 악기 파트", exact: true });
  for (const voice of ["소프라노", "알토", "테너", "베이스"]) await expect(partButtons.getByRole("button", { name: `${voice} · 0음`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/scores\//);
  const score = await page.evaluate(() => JSON.parse(localStorage.getItem("humscore.scores.v1")!)[0]);
  const parts = [score, ...score.parts];
  expect(parts.map((part) => part.partName)).toEqual(["소프라노", "알토", "테너", "베이스"]);
  expect(parts.map((part) => part.clef)).toEqual(["treble", "treble", "bass", "bass"]);
  expect(parts.every((part) => part.instrument === "choir" && part.notes.length === 0 && part.chords.length === 0)).toBe(true);
  expect(score.meter).toBe("4/4");
  expect(score.measureCount).toBe(8);
  const output = page.locator(".score-export");
  await expect(output.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await expect(output.locator("svg text").filter({ hasText: /^주 하나님 지으신 모든 세계$/ })).toHaveAttribute("font-weight", "700");
});
