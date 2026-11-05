import { expect, holdNote, openKeysInput, test } from "./fixtures";

async function enterNotes(page: import("@playwright/test").Page) {
  await openKeysInput(page);
  for (const key of ["a", "s", "d", "f"]) await holdNote(page, key);
  await expect(page.getByText("4개 음표")).toBeVisible();
}

test("제목과 악보는 한 카드이고, 악보 바로 아래에 5개 작업 버튼이 놓인다", async ({ page }) => {
  await enterNotes(page);
  const card = page.getByTestId("score-card");
  await expect(card).toBeVisible();
  await expect(card.getByTestId("score-header")).toBeVisible();
  await expect(card.locator(".score-sheet svg").first()).toBeVisible({ timeout: 20_000 });
  const bar = page.getByRole("region", { name: "악보 작업" });
  const names = await bar.getByRole("button").allTextContents();
  expect(names.map((name) => name.trim())).toEqual(["템플릿으로 시작하기", "악보생성", "악보 편집", "가사 편집", "작곡하기"]);
  const cardBox = (await card.boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(barBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
  expect(barBox.y - (cardBox.y + cardBox.height)).toBeLessThan(40);
  // 악보 시트 안에는 따로 그려진 종이 카드가 없다(제목과 같은 카드)
  expect(await card.locator(".score-sheet-flat").count()).toBeGreaterThan(0);
  // 빠르기·박자는 왼쪽, 작사·작곡·편곡은 오른쪽 끝
  const tempo = (await card.getByTestId("score-header-tempo").boundingBox())!;
  expect(tempo.x - cardBox.x).toBeLessThan(40);
});

test("재생 버튼 옆 음색 선택으로 소리(음색)만 바꾼다", async ({ page }) => {
  await enterNotes(page);
  const timbre = page.getByRole("combobox", { name: "재생 음색" });
  const play = page.getByRole("button", { name: "재생", exact: true });
  const playBox = (await play.boundingBox())!;
  const timbreBox = (await timbre.boundingBox())!;
  expect(timbreBox.x).toBeGreaterThan(playBox.x + playBox.width - 1);
  expect(Math.abs((timbreBox.y + timbreBox.height / 2) - (playBox.y + playBox.height / 2))).toBeLessThan(20);
  await timbre.selectOption("epRhodes");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.instrument)).toBe("epRhodes");
  // 음표는 그대로이고 새 악기(파트)는 생기지 않는다
  await expect(page.getByText("4개 음표")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.parts?.length ?? 0)).toBe(0);
});

test("가사 편집 버튼으로 가사 창을 연다", async ({ page }) => {
  await enterNotes(page);
  await page.getByRole("button", { name: "가사 편집", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toBeVisible();
  await dialog.getByRole("textbox").fill("가 나 다 라");
  await dialog.getByRole("button", { name: "적용", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.notes?.[0]?.lyric)).toBe("가");
});

test("멜로디와 어울리지 않는 코드로 바꾸면 확인 창이 뜬다", async ({ page }) => {
  await enterNotes(page);
  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  await page.getByRole("button", { name: /^1\s*C$/ }).click();
  // C D E F 멜로디에 F#은 맞지 않는다
  await page.getByRole("button", { name: "F#", exact: true }).first().click();
  await page.getByRole("button", { name: "적용", exact: true }).last().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("멜로디와 어울리지 않는 코드예요")).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("button", { name: /^1\s*C$/ })).toBeVisible();
  await page.getByRole("button", { name: "적용", exact: true }).last().click();
  await dialog.getByRole("button", { name: "그래도 변경" }).click();
  await expect(page.getByRole("button", { name: /^1\s*F#$/ })).toBeVisible();
});

test("어울리는 코드(대리코드 포함)는 묻지 않고 바로 바뀐다", async ({ page }) => {
  await enterNotes(page);
  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  await page.getByRole("button", { name: /^1\s*C$/ }).click();
  await page.getByRole("button", { name: "A", exact: true }).first().click();
  await page.getByRole("button", { name: "마이너", exact: true }).click();
  await page.getByRole("button", { name: "적용", exact: true }).last().click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^1\s*Am$/ })).toBeVisible();
});
