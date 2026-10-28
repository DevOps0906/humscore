import { expect, test } from "./fixtures";

test("랜딩: 주요 섹션 렌더링", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("허밍·건반 악보 변환");
  await expect(page.getByRole("heading", { name: /흥얼거리면\s*악보가 됩니다/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "세 단계면 충분합니다" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "자주 묻는 질문" })).toBeVisible();
  // 히어로 진입 링크(체험 띠 카드와 이름이 겹치므로 exact + 첫 번째 = 히어로)
  const record = page.getByRole("link", { name: "흥얼거려서 악보 만들기", exact: true }).first();
  const keys = page.getByRole("link", { name: "건반으로 입력하기", exact: true }).first();
  await expect(record).toBeVisible();
  await expect(record).toHaveAttribute("href", "/record");
  await expect(keys).toBeVisible();
  await expect(keys).toHaveAttribute("href", "/keys");
});

test("랜딩: 헤더 '내 악보 보기'로 /library 이동", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "내 악보 보기" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "내 악보" })).toBeVisible();
});
