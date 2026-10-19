import { createScoreViaKeys, expect, test } from "./fixtures";

test("악보 커서 편집: → ↑ 2 키로 선택·음높이·길이 변경", async ({ page }) => {
  await createScoreViaKeys(page);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

  const toggle = page.getByRole("button", { name: "음표 편집" });
  await expect(async () => {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();

  const sheet = page.getByRole("application", { name: /악보 편집/ });
  await expect(sheet).toBeVisible();
  const live = page.getByTestId("cursor-live");
  const marker = page.getByTestId("score-cursor");

  await page.keyboard.press("ArrowRight"); // 선택 없음 → 첫 음
  await expect(live).toContainText("1번째 음표");
  await expect(marker).toBeVisible({ timeout: 15_000 });
  const before = await marker.boundingBox();

  await page.keyboard.press("ArrowRight");
  await expect(live).toContainText("2번째 음표");
  await expect(async () => {
    const moved = await marker.boundingBox();
    expect(moved!.x).toBeGreaterThan(before!.x + 2);
  }).toPass();

  const text1 = (await live.textContent())!;
  await page.keyboard.press("ArrowUp");
  await expect(live).not.toHaveText(text1);
  await page.keyboard.press("2");
  await expect(live).toContainText("8분음표");

  // 제목 입력창에서는 단축키가 동작하지 않음
  const title = page.getByLabel("악보 제목");
  await title.focus();
  await page.keyboard.press("ArrowRight");
  await expect(live).toContainText("2번째 음표");

  // 악보의 첫 음표 머리를 눌러 선택 
  // (편집 직후엔 악보가 다시 그려지는 중일 수 있어 재시도)
  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, 0)); // 하단 고정 바에 가리지 않게
    await expect(marker).toBeVisible();
    await sheet.evaluate((el) => (el.scrollLeft = 0));
    const head = (await sheet.locator(".vf-stavenote .vf-notehead").first().boundingBox())!;
    await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
    await expect(live).toContainText("1번째 음표", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
});

test("로고는 소개 페이지(/)로 연결", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: "HumScore 홈(소개 페이지)" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("건반 저장 시 입력한 제목이 악보 제목이 됨", async ({ page }) => {
  await page.goto("/keys");
  const toggle = page.getByRole("button", { name: "악보 입력" });
  await expect(async () => {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
  for (const k of ["a", "s", "d"]) await page.keyboard.press(k);
  await expect(page.getByText("3개 음표")).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("제목").fill("테스트 노래");
  await dlg.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  await expect(page.getByLabel("악보 제목")).toHaveValue("테스트 노래");
});
