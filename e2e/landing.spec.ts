import { expect, test } from "./fixtures";

test("랜딩: 주요 섹션 렌더링", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("악보가 됩니다");
  await expect(page.getByRole("heading", { name: "세 단계면 충분합니다" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자주 묻는 질문" })).toBeVisible();
  await expect(page.getByRole("link", { name: /흥얼거려서 악보 만들기/ })).toHaveAttribute("href", "/record");
  await expect(page.getByRole("link", { name: /건반으로 입력하기/ })).toHaveAttribute("href", "/keys");
});

test("랜딩: CTA 로 /library 이동", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "내 악보 보기" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "내 악보" })).toBeVisible();
});
