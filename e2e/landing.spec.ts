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

test("랜딩: 에디터 데모 탭 4개가 해시와 연동되고 같은 12마디 악보를 쓴다", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("#editor-panel");
  await expect(panel.locator('img[src*="hero-score.svg"]').first()).toBeAttached();
  for (const [id, name, label] of [
    ["chords", "코드", /코드/],
    ["transpose", "전조", /G장조에서 A장조/],
    ["perform", "공연", /공연 모드/],
    ["edit", "편집", /음표 하나를 선택/],
  ] as const) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#editor-${id}$`));
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("img")).toHaveAttribute("aria-label", label);
  }
  await expect(panel.getByText("G → A")).toHaveCount(0);
});
