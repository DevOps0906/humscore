import { expect, test } from "./fixtures";

test("녹음: 가짜 마이크로 시작/정지 가능", async ({ page }) => {
  await page.goto("/record");
  await expect(page.getByRole("heading", { name: "흥얼거리면 악보가 됩니다" })).toBeVisible();

  const stop = page.getByRole("button", { name: "녹음 끝내고 악보 만들기" });
  // 하이드레이션 전 클릭 유실 대비 재시도
  await expect(async () => {
    if (!(await stop.isVisible())) await page.getByRole("button", { name: "녹음 시작" }).click();
    await expect(stop).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator("p[role=alert]")).toHaveCount(0);

  await page.waitForTimeout(1500);
  await stop.click();

  // 감지된 음이 없으면 안내 오류 후 대기 상태, 있으면 /scores/<id> — 어느 쪽이든 정상 종료
  await expect(async () => {
    const onScore = /\/scores\/[^/]+$/.test(page.url());
    const idle = await page.getByRole("button", { name: "녹음 시작" }).isVisible();
    expect(onScore || idle).toBe(true);
  }).toPass({ timeout: 15_000 });
});

test("녹음: 박자 3/4·4/4·6/8 선택과 음가 안내", async ({ page }) => {
  await page.goto("/record");
  for (const label of ["3/4", "4/4", "6/8"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "6/8", exact: true }).click();
  await expect(page.getByRole("button", { name: "6/8", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("녹음이 끝나면 소리의 길이(음가)대로 악보에 적혀요")).toBeVisible();
});
