import type { Page } from "@playwright/test";
import { createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";

test.beforeEach(() => { test.setTimeout(120_000); });

async function capture(page: Page, width: number, kind: string) {
  const sheet = page.locator(".score-sheet:visible");
  await sheet.scrollIntoViewIfNeeded();
  await expect(sheet.getByText("악보 그리는 중…", { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await expect(sheet.locator("svg").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `.nomad/task-026/${width}-${kind}.png`, fullPage: true });
}

for (const width of [390, 900, 1440]) {
  test(`${width}px 드럼 그림과 오케스트라 음색 버튼을 선택한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openKeysInput(page);
    await page.getByLabel("악기 선택", { exact: true }).selectOption("drums");
    const kit = page.getByRole("group", { name: "드럼 악기 그림 선택", exact: true });
    await expect(kit.getByRole("button")).toHaveCount(11);
    const snare = kit.getByRole("button", { name: "스네어 선택", exact: true });
    await snare.click();
    await expect(snare).toHaveAttribute("aria-pressed", "true");
    await expect(snare.locator("svg")).toBeVisible();
    const summary = page.getByRole("status").filter({ hasText: "선택한 드럼 구성" });
    await expect(summary).toContainText("스네어 · 일반 음표");
    await page.getByRole("button", { name: "스네어 1마디 1박", exact: true }).click();
    await page.getByRole("button", { name: "닫힌 하이햇 1마디 1박", exact: true }).click();
    await expect(summary).toContainText("선택한 드럼 구성: 닫힌 하이햇 · X형 음표");
    await expect(summary).toContainText("1마디 구성: 스네어 · 닫힌 하이햇");
    await expect(kit.getByRole("button", { name: "닫힌 하이햇 선택", exact: true })).toContainText("현재 마디에 포함");
    await page.getByRole("button", { name: "마디 추가", exact: true }).click();
    await expect(summary).toContainText("2마디 구성: 아직 입력한 악기가 없어요");
    await page.getByLabel("드럼 마디", { exact: true }).selectOption("0");
    await expect(summary).toContainText("1마디 구성: 스네어 · 닫힌 하이햇");
    await capture(page, width, "drums");
    await page.getByLabel("악기 선택", { exact: true }).selectOption("orchestra");
    await page.getByRole("button", { name: "새 악보로 시작", exact: true }).click();
    const family = page.getByLabel("악기군 선택", { exact: true });
    const strings = page.getByRole("group", { name: "현악 음색 프리셋", exact: true });
    await strings.getByRole("button", { name: "첼로", exact: true }).click();
    await expect(strings.getByRole("button", { name: "첼로", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("음색 선택", { exact: true })).toHaveCount(0);
    await family.selectOption("woodwinds");
    const woodwinds = page.getByRole("group", { name: "목관 음색 프리셋", exact: true });
    await expect(woodwinds.getByRole("button")).toHaveCount(6);
    await woodwinds.getByRole("button", { name: "오보에", exact: true }).click();
    await expect(woodwinds.getByRole("button", { name: "오보에", exact: true })).toHaveAttribute("aria-pressed", "true");
    await capture(page, width, "orchestra");
  });

  test(`${width}px 저장 악보 편집모드에서 하위 도구와 크레딧을 관리한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const id = await createScoreViaKeys(page);
    const edit = page.getByRole("button", { name: "편집모드", exact: true });
    const panel = page.getByRole("region", { name: "악보 편집 옵션", exact: true });
    await expect(edit).toHaveAttribute("aria-pressed", "false");
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "작곡", exact: true })).toBeVisible();
    await expect(page.getByTestId("score-header-credits")).toHaveCount(0);
    await page.goto("/library");
    await page.getByRole("button", { name: /더보기$/ }).first().click();
    await page.getByRole("menuitem", { name: "편집모드", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/scores/${id}`));
    await expect(edit).toHaveAttribute("aria-pressed", "true");
    await expect(edit).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toBeVisible();
    for (const name of ["고급 리하모니제이션", "음표 편집", "가사 등록"]) await expect(panel.getByRole("button", { name, exact: true })).toBeVisible();
    await expect.poll(() => panel.getByRole("textbox").evaluateAll((inputs) => inputs.map((input) => input.getAttribute("aria-label")))).toEqual(["작사자", "작곡자", "편곡자"]);
    for (const [label, value] of [["작사자", "테스트 작사"], ["작곡자", "테스트 작곡"], ["편곡자", "테스트 편곡"]]) {
      await panel.getByRole("textbox", { name: label, exact: true }).fill(value);
      await panel.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await expect(page.getByTestId("score-header-credits")).toHaveText("작사 테스트 작사 · 작곡 테스트 작곡 · 편곡 테스트 편곡");
    await panel.getByRole("textbox", { name: "작곡자", exact: true }).fill("");
    await panel.getByRole("textbox", { name: "작곡자", exact: true }).press("Enter");
    await expect(page.getByTestId("score-header-credits")).toHaveText("작사 테스트 작사 · 편곡 테스트 편곡");
    await panel.getByRole("button", { name: "음표 편집", exact: true }).click();
    await expect(panel.getByRole("button", { name: "음표 편집", exact: true })).toHaveAttribute("aria-pressed", "true");
    await edit.click();
    await expect(panel).toHaveCount(0);
    await edit.click();
    await expect(panel.getByRole("button", { name: "음표 편집", exact: true })).toHaveAttribute("aria-pressed", "false");
    await capture(page, width, "editor");
    await page.reload();
    await expect(page.getByTestId("score-header-credits")).toHaveText("작사 테스트 작사 · 편곡 테스트 편곡");
    await edit.click();
    for (const label of ["작사자", "편곡자"]) {
      await panel.getByRole("textbox", { name: label, exact: true }).fill("   ");
      await panel.getByRole("textbox", { name: label, exact: true }).press("Enter");
    }
    await expect(page.getByTestId("score-header-credits")).toHaveCount(0);
  });

  test(`${width}px 반주 모드와 아르페지오 템플릿 10개를 저장하고 복원한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const id = await createScoreViaKeys(page);
    const mode = page.getByRole("combobox", { name: "반주 모드", exact: true });
    await expect(mode).toHaveValue("block");
    await mode.scrollIntoViewIfNeeded();
    await expect(mode).toBeVisible();
    await mode.selectOption("arpeggio");
    const patterns = page.getByRole("group", { name: "아르페지오 템플릿", exact: true });
    await expect(patterns.getByRole("button")).toHaveCount(10);
    const names = await patterns.getByRole("button").allTextContents();
    for (const name of names) {
      const button = patterns.getByRole("button", { name: name.trim(), exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
    await expect.poll(() => page.evaluate((scoreId) => {
      const scores = JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]");
      return scores.find((score: { id: string }) => score.id === scoreId)?.accompaniment;
    }, id)).toEqual({ mode: "arpeggio", pattern: "rolling16" });
    await expect(page.getByRole("button", { name: "피아노", exact: true })).toHaveAttribute("aria-pressed", "true");
    await capture(page, width, "accompaniment");
    await page.reload();
    await expect(mode).toHaveValue("arpeggio");
    await expect(patterns.getByRole("button", { name: "흐르는 16분", exact: true })).toHaveAttribute("aria-pressed", "true");
    await mode.selectOption("block");
    await expect(patterns).toHaveCount(0);
    await page.reload();
    await expect(mode).toHaveValue("block");
    await mode.selectOption("arpeggio");
    await expect(patterns.getByRole("button", { name: "흐르는 16분", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}
