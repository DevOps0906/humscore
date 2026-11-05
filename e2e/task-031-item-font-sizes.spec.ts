import { holdNote, expect, openKeysInput, test } from "./fixtures";

test("제목·제작자 글자 크기를 따로 바꾸고 저장하며 가운데 정렬로 보인다", async ({ page }) => {
  test.setTimeout(120_000);
  await openKeysInput(page);
  for (const key of ["a", "s", "d"]) await holdNote(page, key);
  await page.getByRole("button", { name: "글꼴·크기·굵기 설정", exact: true }).click();
  const title = page.getByLabel("제목 글자 크기", { exact: true });
  await title.focus();
  await title.press("End");
  await expect(title).toHaveValue("48");
  const heading = page.getByTestId("score-header").getByRole("heading");
  await expect(heading).toHaveCSS("font-size", "48px");
  await expect(heading).toHaveCSS("text-align", "center");
  await expect(page.getByTestId("score-header")).toHaveCSS("text-align", "center");
  await page.getByRole("button", { name: "제목 크기 자동", exact: true }).click();
  await expect(heading).toHaveCSS("font-size", "24px");
});
