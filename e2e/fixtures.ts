import { expect, test as base, type Page } from "@playwright/test";

/**
 * 공용 fixture
 * - Supabase 네트워크 차단 (실제 메일/세션 호출 방지). 테스트에서 page.route 로 덮어쓸 수 있음.
 * - 처리되지 않은 페이지 오류(pageerror)를 수집하고 테스트 종료 시 실패 처리.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*.supabase.co/**", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
      );
      await use(errors);
      expect(errors, "uncaught page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * /keys 로 이동해 "악보 입력"을 켠다.
 * 모바일 세로 화면에서는 "가로로 돌려 주세요" 덮개(role=alert)가 비동기로 떠 클릭을 막으므로
 * "세로로 그냥 보기"를 눌러 닫는다(언제 떠도 처리되도록 locator handler 등록).
 * 주의: 같은 버튼을 직접 click 하지 말 것 — handler 가 먼저 닫아 버려 그 click 이 무한 대기한다.
 */
export async function openKeysInput(page: Page): Promise<void> {
  await page.addLocatorHandler(page.getByRole("button", { name: "세로로 그냥 보기" }), (b) => b.click());
  await page.goto("/keys");
  const toggle = page.getByRole("button", { name: "악보 입력" });
  // 하이드레이션 전 클릭 유실 대비: 눌린 상태가 될 때까지 재시도
  await expect(async () => {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
}

/** /keys 에서 PC 키보드(A,S,D)로 음 3개를 입력하고 저장 → /scores/<id> 로 이동. id 반환 */
export async function createScoreViaKeys(page: Page): Promise<string> {
  await openKeysInput(page);
  for (const k of ["a", "s", "d"]) await page.keyboard.press(k);
  await expect(page.getByText("3개 음표")).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장" }).click();
  // 제목 대화상자: 기본 제목으로 저장
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  return page.url().split("/scores/")[1];
}
