import { expect, test } from "./fixtures";

// 탭 이름 → 그 탭에서 보이는 섹션 이름
const SECTIONS: [string, string][] = [["계정", "계정·동기화"], ["마이크", "마이크 점검"], ["기본값", "기본값"], ["공유 링크", "공유 링크 관리"], ["LLM API", "LLM API"], ["도움말", "도움말·정보"]];

test("설정: 하단 탭으로 이동, 6개 설정 탭과 섹션 표시", async ({ page }) => {
  await page.goto("/library");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav.getByRole("listitem")).toHaveCount(5);
  await nav.getByRole("link", { name: "설정" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "설정" })).toHaveAttribute("aria-current", "page");
  const tabs = page.getByRole("tablist", { name: "설정 항목" });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  for (const [tab, name] of SECTIONS) {
    await tabs.getByRole("tab", { name: tab, exact: true }).click();
    await expect(tabs.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name })).toBeVisible();
    // 한 번에 한 탭의 내용만 보인다
    for (const [otherTab, otherName] of SECTIONS) if (otherTab !== tab) await expect(page.getByRole("region", { name: otherName })).toHaveCount(0);
  }
  await expect(page.getByRole("link", { name: /GitHub 이슈/ })).toHaveAttribute("href", "https://github.com/DevOps0906/humscore/issues");
  await expect(page.getByText("0.1.0")).toBeVisible();
});

test("설정: 기본 템포·박자 저장 후 새로고침해도 유지", async ({ page }) => {
  await page.goto("/settings#defaults");
  const slider = page.getByRole("slider", { name: "새 악보 기본 템포" });
  const label = page.getByTestId("default-bpm");
  // 하이드레이션 후 저장값 복원이 끝날 때까지 재시도
  await expect(async () => {
    await slider.fill("120");
    await expect(label).toHaveText("120 BPM", { timeout: 500 });
  }).toPass();
  await page.getByRole("group", { name: "새 악보 기본 박자" }).getByRole("button", { name: "3/4" }).click();
  await page.reload();
  await expect(page.getByTestId("default-bpm")).toHaveText("120 BPM");
  await expect(page.getByRole("group", { name: "새 악보 기본 박자" }).getByRole("button", { name: "3/4" })).toHaveAttribute("aria-pressed", "true");
});

test("모바일: 설정 화면 가로 넘침 없음, 하단 탭 5개가 한 줄", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "모바일 프로젝트 전용");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const over = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
  const tops = await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("listitem")
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops).toHaveLength(5);
  expect(new Set(tops).size).toBe(1);
});
