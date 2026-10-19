import { expect, test } from "./fixtures";

for (const path of ["/", "/library", "/keys", "/login"]) {
  test(`모바일: 가로 스크롤 없음 ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "모바일 프로젝트 전용");
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { sw, iw } = await page.evaluate(() => ({
      sw: document.scrollingElement!.scrollWidth,
      iw: window.innerWidth,
    }));
    expect(sw).toBeLessThanOrEqual(iw);
  });
}
