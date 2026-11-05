import { expect, holdNote, openKeysInput, test } from "./fixtures";

test("건반 아래 재생 버튼: 음표가 없으면 비활성, 있으면 재생·중지", async ({ page }) => {
  await openKeysInput(page);
  const play = page.getByRole("button", { name: "재생", exact: true });
  await expect(play).toBeDisabled();
  await holdNote(page, "a");
  await expect(play).toBeEnabled();
  // 건반 영역 바로 아래에 놓인다
  const keyboard = await page.getByTestId("piano-scroller").boundingBox();
  const button = await play.boundingBox();
  expect(button!.y).toBeGreaterThan(keyboard!.y + keyboard!.height - 1);
  await play.click();
  const stop = page.getByRole("button", { name: "재생 중지", exact: true });
  await expect(stop).toBeVisible();
  await stop.click();
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeVisible();
});

test("지속음 길이 슬라이더: 값을 바꾸면 저장되고 새로고침해도 유지된다", async ({ page }) => {
  await openKeysInput(page);
  const slider = page.getByRole("slider", { name: "지속음 길이" });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue("1");
  await slider.fill("0.5");
  await expect(slider).toHaveAttribute("aria-valuetext", "50%");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("humscore.sustainRatio"))).toBe("0.5");
  await page.reload();
  await expect(page.getByRole("slider", { name: "지속음 길이" })).toHaveValue("0.5");
});
