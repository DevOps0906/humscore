import type { Page } from "@playwright/test";
import { createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";
import { buildScoreTemplate, SCORE_TEMPLATES } from "../src/lib/music/score-templates";

async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]")[0]);
}

test.beforeEach(() => test.setTimeout(120_000));

test("악기 전환으로 독립 악보를 추가하고 초안과 저장 악보에 모든 음표를 보존한다", async ({ page }) => {
  await openKeysInput(page);
  for (const key of ["a", "s", "d"]) await page.keyboard.press(key);
  await page.getByLabel("악기 선택", { exact: true }).selectOption("guitarTab");
  await page.getByLabel("음색 선택", { exact: true }).selectOption("bassGuitar5");
  await page.getByRole("region", { name: "베이스 기타 지판", exact: true }).locator("button[data-fret='0']").first().click();
  await page.getByLabel("악기 선택", { exact: true }).selectOption("drums");
  await page.getByRole("button", { name: "스네어 1마디 1박", exact: true }).click();
  const kit = page.getByRole("group", { name: "전체 드럼셋에서 선택", exact: true });
  await expect(kit.getByRole("button", { name: "드럼셋 스네어 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("group", { name: "드럼 악기 그림 선택", exact: true }).getByRole("button", { name: "라이드 선택", exact: true }).click();
  await expect(kit.getByRole("button", { name: "드럼셋 라이드 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  await kit.getByRole("button", { name: "드럼셋 베이스드럼 선택", exact: true }).click();
  await expect(page.getByRole("group", { name: "드럼 악기 그림 선택", exact: true }).getByRole("button", { name: "베이스드럼 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByLabel("악기 선택", { exact: true })).toHaveValue("drums");
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/scores\//);
  const score = await saved(page);
  expect(score.notes.map((note: { midi: number }) => note.midi)).toEqual([60, 62, 64]);
  expect(score.parts.find((part: { instrument: string }) => part.instrument === "bassGuitar5").notes[0].midi).toBeLessThan(48);
  expect(score.parts.find((part: { instrument: string }) => part.instrument === "drumKit").notes.map((note: { midi: number }) => note.midi)).toEqual([38]);
});

test("기존 악보에 악기를 추가하고 적용은 편집 유지·저장은 편집 종료한다", async ({ page }) => {
  await createScoreViaKeys(page);
  await page.getByRole("button", { name: "악기 추가하기", exact: true }).click();
  const add = page.getByRole("dialog");
  await add.getByLabel("악기 선택", { exact: true }).selectOption("orchestra");
  await add.getByRole("button", { name: "첼로", exact: true }).click();
  await add.getByRole("button", { name: "악보 추가", exact: true }).click();
  const actions = page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true });
  await expect(actions).toBeVisible();
  await page.getByRole("textbox", { name: "악보 제목", exact: true }).fill("독립 파트 편집");
  await actions.getByRole("button", { name: "적용", exact: true }).click();
  await expect(actions).toBeVisible();
  await expect.poll(async () => (await saved(page)).title).toBe("독립 파트 편집");
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await expect(actions).toBeVisible();
  await actions.getByRole("button", { name: "저장", exact: true }).click();
  await expect(actions).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("group", { name: "편집할 악기 파트", exact: true }).getByRole("button", { name: /첼로/ })).toBeVisible();
  expect((await saved(page)).notes).toHaveLength(3);
});

test("다른 탭에서 삭제된 악보의 편집 초안을 다시 저장하지 않는다", async ({ page }) => {
  await createScoreViaKeys(page);
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await page.getByRole("textbox", { name: "악보 제목", exact: true }).fill("삭제 뒤 남으면 안 되는 초안");
  await page.getByRole("textbox", { name: "악보 제목", exact: true }).press("Tab");
  await page.evaluate(() => {
    localStorage.setItem("humscore.scores.v1", "[]");
    window.dispatchEvent(new StorageEvent("storage", { key: "humscore.scores.v1" }));
  });
  await expect(page.getByText("악보를 찾을 수 없어요.", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true })).toHaveCount(0);
  expect(await saved(page)).toBeUndefined();
});

for (const width of [390, 900, 1440]) test(`${width}px 템플릿 설정 마법사로 밴드 스코어를 만들고 드럼 양쪽 선택을 확인한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await openKeysInput(page);
  await page.getByRole("button", { name: "템플릿으로 시작하기", exact: true }).click();
  const wizard = page.getByRole("dialog");
  await wizard.getByRole("button", { name: /밴드 스코어/ }).click();
  await wizard.getByRole("button", { name: "다음", exact: true }).click();
  await expect(wizard.getByRole("checkbox", { name: "베이스기타(4현)", exact: true })).toBeChecked();
  await wizard.getByRole("button", { name: "다음", exact: true }).click();
  await wizard.getByLabel("템플릿 악보 제목", { exact: true }).fill("밴드 편성 테스트");
  await wizard.getByLabel("템플릿 마디 수", { exact: true }).selectOption("4");
  await wizard.getByRole("button", { name: "이 템플릿으로 악보 생성", exact: true }).click();
  const parts = page.getByRole("group", { name: "편집할 악기 파트", exact: true });
  await expect(parts.getByRole("button")).toHaveCount(5);
  await expect(parts.getByRole("button", { name: /합창/ })).toBeVisible();
  await parts.getByRole("button", { name: /드럼 키트/ }).click();
  await page.getByRole("group", { name: "드럼 악기 그림 선택", exact: true }).getByRole("button", { name: "스네어 선택", exact: true }).click();
  await expect(page.getByRole("group", { name: "전체 드럼셋에서 선택", exact: true }).getByRole("button", { name: "드럼셋 스네어 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.nomad/task-027/${width}-band-drums.png`, fullPage: true });
});

test("관현악 총보를 A4 비율로 인쇄하며 모든 악기와 마디를 포함한다", async ({ page }, testInfo) => {
  const instruments = [...SCORE_TEMPLATES.find((entry) => entry.id === "orchestra")!.instruments];
  const score = buildScoreTemplate({ template: "orchestra", instruments, title: "관현악 출력 검수", bpm: 96, meter: "4/4", measures: 8, tonic: 7 });
  await page.goto("/library");
  await page.evaluate((score) => localStorage.setItem("humscore.scores.v1", JSON.stringify([score])), score);
  await page.goto(`/scores/${score.id}`);
  const output = page.locator(".score-export");
  await expect(output.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
  await expect(output.locator(".vf-measure")).toHaveCount(instruments.length * 8);
  await expect(output.locator("svg")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  await expect(output).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
  expect(await output.locator(".score-sheet").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
  await expect(page.getByRole("button", { name: "악기 추가하기", exact: true })).not.toBeVisible();
  const dimensions = await output.evaluate((element) => {
    const svg = element.querySelector("svg")!;
    const box = svg.getBoundingClientRect();
    const right = Math.max(...[...svg.querySelectorAll(".vf-measure > path")].map((path) => path.getBoundingClientRect().right));
    return { width: box.width, paper: element.getBoundingClientRect().width, viewBox: svg.getAttribute("viewBox"), right, svgRight: box.right };
  });
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.paper + 1);
  expect(dimensions.viewBox).toBeTruthy();
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.svgRight + 1);
  if (testInfo.project.name === "desktop") await page.pdf({ path: ".nomad/task-027/orchestra-a4.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
});

test("붙임줄·이음줄을 적용한 뒤 새로고침해도 표기가 남는다", async ({ page }) => {
  await openKeysInput(page);
  for (const key of ["a", "a", "d"]) await page.keyboard.press(key);
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/scores\//);
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await page.getByRole("button", { name: "음표 편집", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "붙임줄", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "이음줄", exact: true }).click();
  await page.getByRole("textbox", { name: "선택 음표 코드", exact: true }).fill("Gm");
  await page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true }).getByRole("button", { name: "적용", exact: true }).click();
  expect((await saved(page)).chords).toContainEqual({ startBeat: 1, symbol: "Gm" });
  await expect(page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true })).toBeVisible();
  await page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true }).getByRole("button", { name: "저장", exact: true }).click();
  expect((await saved(page)).notes[0].tieToNext).toBe(true);
  expect((await saved(page)).notes[1].slurToNext).toBe(true);
  await page.reload();
  await expect(page.locator(".score-sheet:visible .vf-stavetie").first()).toBeVisible({ timeout: 20_000 });
});

for (const count of [5, 9]) test(`${count}마디 출력의 마지막 한 마디가 네 마디 폭으로 늘어나지 않는다`, async ({ page }) => {
  await page.goto("/library");
  const id = "fd93cf43-0a16-419f-b624-270f68a61f92";
  await page.evaluate(({ id, count }) => localStorage.setItem("humscore.scores.v1", JSON.stringify([{
    id, title: "마디 정렬 확인", bpm: 90, beatsPerMeasure: 4, beatUnit: 4, key: { tonic: 0, mode: "major", fifths: 0 }, transpose: 0,
    notes: Array.from({ length: count * 4 }, (_, index) => ({ midi: 60 + index % 5, startBeat: index, durationBeats: 1 })), chords: [],
    createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z", instrument: "piano", notation: "piano",
  }])), { id, count });
  await page.goto(`/scores/${id}`);
  const sheet = page.locator(".score-sheet:visible").first();
  await expect(sheet.locator(".vf-measure")).toHaveCount(count, { timeout: 20_000 });
  const boxes = await sheet.locator(".vf-measure").evaluateAll((elements) => elements.map((element) => { const rect = element.querySelector(":scope > path")!.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width }; }));
  expect(boxes[count - 1].width).toBeLessThan(boxes[0].width * 1.15);
  expect(boxes[count - 1].width).toBeGreaterThan(boxes[0].width * 0.85);
  expect(Math.abs(boxes[4].x - boxes[0].x)).toBeLessThan(3);
  if (count === 9) {
    for (let column = 0; column < 4; column++) expect(Math.abs(boxes[column + 4].x - boxes[column].x)).toBeLessThan(3);
    expect(Math.abs(boxes[8].x - boxes[0].x)).toBeLessThan(3);
  }
  await page.screenshot({ path: `.nomad/task-027/layout-${count}.png`, fullPage: true });
});
