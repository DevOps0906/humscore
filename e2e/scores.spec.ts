import { createScoreViaKeys, expect, test } from "./fixtures";

test("건반 입력 → 저장 → 라이브러리 → 악보 보기 → 전조 → 공연 모드", async ({ page }) => {
  const id = await createScoreViaKeys(page);

  // 악보 화면: OSMD 가 svg 를 그림
  await expect(page.getByLabel("악보 제목")).toHaveValue(/건반 입력/);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

  // 라이브러리에 표시
  await page.getByRole("link", { name: "내 악보" }).click();
  await expect(page).toHaveURL(/\/library$/);
  const card = page.locator(`a[href="/scores/${id}"]`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/scores/${id}$`));
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

  // 전조: 키 라벨 변경
  const keyBtn = page.getByRole("button", { name: /^현재 .+키, 누르면 원래 키로$/ });
  const before = await keyBtn.getAttribute("aria-label");
  await page.getByRole("button", { name: "반음 올리기" }).click();
  await expect(keyBtn).not.toHaveAttribute("aria-label", before!);
  await page.getByRole("button", { name: "반음 내리기" }).click();
  await expect(keyBtn).toHaveAttribute("aria-label", before!);
  await page.getByRole("button", { name: "반음 올리기" }).click();

  // 공연 모드: TabBar 숨김
  const tabBar = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(tabBar).toBeVisible();
  await page.getByRole("link", { name: "공연 모드" }).click();
  await expect(page).toHaveURL(new RegExp(`/scores/${id}/perform$`));
  await expect(page.getByRole("link", { name: /닫기/ })).toBeVisible();
  await expect(tabBar).toHaveCount(0);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

  // 돌아오기 (전조 값 유지)
  await page.getByRole("link", { name: /닫기/ }).click();
  await expect(page).toHaveURL(new RegExp(`/scores/${id}$`));
  await expect(tabBar).toBeVisible();
  await expect(page.getByRole("button", { name: /^현재 .+키/ }).getByText(/· \+1/)).toBeVisible();
});

test("삭제: 취소하면 유지, 확인하면 라이브러리에서 사라짐", async ({ page }) => {
  const id = await createScoreViaKeys(page);

  await page.getByRole("button", { name: "악보 삭제" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("이 악보를 삭제할까요?");
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/scores/${id}$`));

  await page.getByRole("button", { name: "악보 삭제" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.locator(`a[href="/scores/${id}"]`)).toHaveCount(0);
  await expect(page.getByText("아직 악보가 없어요")).toBeVisible();
});

test("영속성: 새로고침 후에도 악보 유지 (localStorage)", async ({ page }) => {
  const id = await createScoreViaKeys(page);
  const stored = await page.evaluate(() => localStorage.getItem("humscore.scores.v1"));
  expect(stored).toContain(id);

  await page.reload();
  await expect(page.getByLabel("악보 제목")).toHaveValue(/건반 입력/);

  await page.goto("/library");
  await expect(page.locator(`a[href="/scores/${id}"]`)).toBeVisible();
});

test("레거시 리다이렉트: /score?id=abc, /perform?id=abc", async ({ page }) => {
  await page.goto("/score?id=abc");
  // 주의: 리다이렉트가 원본 쿼리(?id=abc)를 그대로 달고 옴 (경로만 검증)
  await expect(page).toHaveURL(/\/scores\/abc(\?.*)?$/);
  await expect(page.getByText("악보를 찾을 수 없어요.")).toBeVisible();

  await page.goto("/perform?id=abc");
  await expect(page).toHaveURL(/\/scores\/abc\/perform(\?.*)?$/);
  await expect(page.getByText("악보를 찾을 수 없어요.")).toBeVisible();
});

test("레거시 리다이렉트는 308", async ({ request }) => {
  const res = await request.get("/score?id=abc", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toContain("/scores/abc");
});

test("없는 id: not-found 상태와 라이브러리 링크", async ({ page }) => {
  await page.goto("/scores/does-not-exist");
  await expect(page.getByText("악보를 찾을 수 없어요.")).toBeVisible();
  await page.getByRole("link", { name: "내 악보로" }).click();
  await expect(page).toHaveURL(/\/library$/);
});
