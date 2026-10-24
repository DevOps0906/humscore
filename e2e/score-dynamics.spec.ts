import { createScoreViaKeys, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function enterEditMode(page: Page) {
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByRole("button", { name: "음표 편집" });
  await expect(async () => {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
  await expect(page.getByTestId("cursor-live")).toBeAttached();
}

/** 첫 음표를 눌러 도구 모음을 연다 */
async function openToolbar(page: Page, isMobile: boolean) {
  const live = page.getByTestId("cursor-live");
  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const head = (await page.locator(".score-sheet .vf-stavenote .vf-notehead").first().boundingBox())!;
    const x = head.x + head.width / 2;
    const y = head.y + head.height / 2;
    if (isMobile) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await expect(live).toContainText("1번째 음표", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  const toolbar = page.getByTestId("score-toolbar");
  await expect(toolbar).toBeVisible();
  return toolbar;
}

test("셈여림 지정 → 악보에 기호 표시, 다시 누르면 제거", async ({ page, isMobile }) => {
  await createScoreViaKeys(page);
  await enterEditMode(page);
  const toolbar = await openToolbar(page, isMobile);
  const svg = page.locator(".score-sheet svg").first();

  const ff = toolbar.getByRole("button", { name: /^ff / });
  await ff.click();
  await expect(ff).toHaveAttribute("aria-pressed", "true");
  // OSMD 가 셈여림을 SVG 글리프로 그림 (기호 개수가 늘어남)
  await expect(page.locator(".score-sheet svg").first()).toContainText("ff", { timeout: 15_000 });

  await expect(page.getByTestId("score-toolbar").getByRole("button", { name: /^ff / })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("score-toolbar").getByRole("button", { name: "셈여림 제거" }).click();
  await expect(svg).not.toContainText("ff", { timeout: 15_000 });
});

test("도돌이표 지정 → 반복 마디선 표시, 메뉴에서 선택 상태 확인", async ({ page, isMobile }) => {
  await createScoreViaKeys(page);
  await enterEditMode(page);
  const toolbar = await openToolbar(page, isMobile);

  const menuBtn = toolbar.getByRole("button", { name: /1마디 기호/ });
  await menuBtn.click();
  await page.getByRole("menuitemcheckbox", { name: "도돌이 끝 :‖" }).click();

  await expect(page.getByTestId("score-toolbar").getByRole("button", { name: /1마디 기호/ })).toContainText("(1)");
  // 반복 마디선: 저장된 악보에 marks 가 들어가고 악보가 다시 그려짐
  await expect
    .poll(async () => page.evaluate(() => JSON.stringify(Object.entries(localStorage))), { timeout: 10_000 })
    .toContain("repeatEnd");

  await page.getByTestId("score-toolbar").getByRole("button", { name: /1마디 기호/ }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "도돌이 끝 :‖" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
});
