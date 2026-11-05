import { holdNote, expect, openKeysInput, test } from "./fixtures";

test("건반 입력 마치기 → 실제 마디만 유지 → 편집으로 마디 자동 확장 → 저장", async ({ page }) => {
  await openKeysInput(page);
  const measures = page.locator(".score-sheet:not(.score-export .score-sheet) svg .vf-measure");
  // 누른 시간이 음표 길이라 실제 길이는 타이밍에 따라 조금 달라진다. 저장된 초안의 끝 박으로 기대 마디 수를 계산한다.
  const expectedMeasures = () => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null");
    const last = draft.notes.at(-1);
    return Math.max(1, Math.ceil((last.startBeat + last.durationBeats) / 4 - 1e-9));
  });
  await expect(measures).toHaveCount(8, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "악보 편집", exact: true })).toBeVisible();

  for (const key of ["a", "s", "d", "f"]) await holdNote(page, key);
  await expect(page.getByText("4개 음표")).toBeVisible();
  await page.getByRole("button", { name: "입력 마치기", exact: true }).click();
  await expect(measures).toHaveCount(await expectedMeasures(), { timeout: 15_000 });

  // 완료 뒤에는 소리만 내고 악보에는 음을 추가하지 않는다.
  await holdNote(page, "g");
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null");
    return draft?.notes.length;
  })).toBe(4);

  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "악보 편집", exact: true })).toHaveAttribute("aria-pressed", "true");
  await holdNote(page, "g");
  await expect(page.getByText("5개 음표")).toBeVisible();
  await expect(measures).toHaveCount(await expectedMeasures(), { timeout: 15_000 });
  await page.getByRole("button", { name: "편집 마치기", exact: true }).click();
  await expect(measures).toHaveCount(await expectedMeasures());

  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  await expect(measures).toHaveCount(2, { timeout: 15_000 });
  const id = page.url().split("/scores/")[1];
  const saved = await page.evaluate((scoreId) => {
    const scores = JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]");
    return scores.find((score: { id: string }) => score.id === scoreId);
  }, id);
  expect(saved.notes).toHaveLength(5);
  expect(saved.notes[4].startBeat).toBe(4);
});

test("입력 중 저장을 열면 남는 마디를 정리하고 편집을 다시 시작할 수 있다", async ({ page }) => {
  await openKeysInput(page);
  await page.keyboard.press("a");
  await expect(page.getByText("1개 음표")).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".score-sheet:not(.score-export .score-sheet) svg .vf-measure")).toHaveCount(1, { timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".score-sheet:not(.score-export .score-sheet) svg .vf-measure")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".score-sheet:not(.score-export .score-sheet) svg .vf-measure")).toHaveCount(1, { timeout: 15_000 });
  await page.keyboard.press("d");
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null");
    return draft?.notes.length;
  })).toBe(1);
  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  await page.keyboard.press("s");
  await expect(page.getByText("2개 음표")).toBeVisible();
});

test("건반 악보 도구는 모바일·태블릿·데스크톱에서 화면 밖으로 넘치지 않는다", async ({ page }, testInfo) => {
  await openKeysInput(page);
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "입력 마치기", exact: true }).click();
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "악보 편집", exact: true })).toBeVisible();
    await expect(page.locator("main header").first()).toHaveCSS("display", "flex");
    await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.nomad/keys-entry-${testInfo.project.name}-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "악보 편집", exact: true }).click();
    await expect(page.getByRole("button", { name: "편집 마치기", exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.nomad/keys-edit-${testInfo.project.name}-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "편집 마치기", exact: true }).click();
  }
});
