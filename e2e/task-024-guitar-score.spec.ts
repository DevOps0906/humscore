import type { Locator, Page } from "@playwright/test";
import type { Score } from "../src/lib/music/types";
import { createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";

async function savedScores(page: Page): Promise<Score[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]"));
}

async function activate(target: Locator, touch: boolean) {
  if (touch) await target.tap();
  else await target.click();
}

test("작곡하기는 건반에서 바로 열리고 취소·저장·새로고침 뒤 다시 사용해도 악보를 중복 생성하지 않는다", async ({ page }) => {
  await openKeysInput(page);
  await expect(page.getByRole("heading", { name: "건반으로 악보생성", exact: true })).toBeVisible();
  await expect(page.getByText(/f = 440/)).toHaveCount(0);
  const button = page.getByRole("button", { name: "작곡하기", exact: true });
  const dialog = page.getByRole("dialog");
  await button.click();
  await expect(page).toHaveURL(/\/keys$/);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(button).toBeEnabled();
  await button.click();
  await dialog.getByLabel("작곡 마디 수", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await dialog.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeEnabled();
  await expect.poll(async () => (await savedScores(page)).length).toBe(1);
  const original = (await savedScores(page))[0];
  expect(Math.max(...original.notes.map((note) => note.startBeat + note.durationBeats))).toBe(8);
  await page.reload();
  await expect(button).toBeEnabled();
  await button.click();
  await dialog.getByLabel("작곡 마디 수", { exact: true }).fill("1");
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await dialog.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const after = await savedScores(page);
  expect(after).toHaveLength(1);
  expect(after[0].id).toBe(original.id);
  expect(Math.max(...after[0].notes.map((note) => note.startBeat + note.durationBeats))).toBe(12);
  await expect(button).toBeEnabled();
});

test("기타 4종은 실제 지판으로 바뀌고 피아노·TAB 보기와 6줄·4줄 튜닝을 표시한다", async ({ page }, testInfo) => {
  await openKeysInput(page);
  const touch = testInfo.project.name === "mobile";
  const instrument = page.getByLabel("악기 음색", { exact: true });
  await expect(instrument.locator("option")).toHaveCount(5);
  const tab = page.getByRole("region", { name: "TAB 악보", exact: true });
  await expect(tab).toHaveCount(0);
  for (const value of ["classicalGuitar", "electricGuitar", "acousticGuitar", "bassGuitar"]) {
    await instrument.selectOption(value);
    const bass = value === "bassGuitar";
    const fretboard = page.getByRole("region", { name: bass ? "베이스 기타 지판" : "기타 지판", exact: true });
    await expect(fretboard).toBeVisible();
    await expect(fretboard.locator("button[data-string][data-fret]")).toHaveCount((bass ? 4 : 6) * 7);
    await activate(fretboard.locator('button[data-string="1"][data-fret="0"]'), touch);
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.notes?.map((note: { midi: number }) => note.midi))).toEqual([64, 64, 64, 43]);
  await page.getByRole("button", { name: "TAB", exact: true }).click();
  await expect(tab).toBeVisible();
  await expect(tab.getByRole("heading")).toContainText("베이스");
  await expect(tab.getByTestId("tab-note")).toHaveCount(4);
  const normal = page.locator(".score-sheet");
  const normalBox = await normal.boundingBox();
  const tabBox = await tab.boundingBox();
  expect(tabBox!.y).toBeGreaterThan(normalBox!.y + normalBox!.height - 1);
  await instrument.selectOption("acousticGuitar");
  await expect(tab.getByRole("heading")).toContainText("통기타");
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(tab).toBeVisible();
    await expect(normal.getByText("악보 그리는 중…", { exact: true })).toHaveCount(0);
    await expect(normal.locator("svg").first()).toBeVisible();
    if (width >= 900) {
      await expect.poll(() => normal.evaluate((element) => {
        const svg = element.querySelector("svg");
        return svg ? svg.getBoundingClientRect().width >= element.clientWidth - 40 : false;
      })).toBe(true);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.nomad/task-024-guitar-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
  await instrument.selectOption("piano");
  await expect(tab).toHaveCount(0);
  await expect(page.getByRole("region", { name: "기타 지판", exact: true })).toHaveCount(0);
  await expect(normal).toHaveCount(1);
});

test("건반 악보 편집에서 음표와 코드 클릭·터치로 옵션을 열어 해당 박의 코드만 고친다", async ({ page }, testInfo) => {
  await openKeysInput(page);
  for (const key of ["a", "s", "d"]) await page.keyboard.press(key);
  await page.getByRole("button", { name: "입력 마치기", exact: true }).click();
  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  const heads = page.locator(".score-sheet .vf-notehead");
  // OSMD는 마디 끝을 채우는 쉼표도 vf-notehead로 그리므로 입력한 두 번째 음표를 고른다.
  await expect(heads.nth(1)).toBeVisible({ timeout: 20_000 });
  await activate(heads.nth(1), testInfo.project.name === "mobile");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "음표 코드 변경", exact: true })).toBeVisible();
  await dialog.getByLabel("코드 근음", { exact: true }).selectOption("F");
  await dialog.getByLabel("코드 종류", { exact: true }).selectOption("m7");
  await expect(dialog.getByLabel("선택 음표 코드", { exact: true })).toHaveValue("Fm7");
  await dialog.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const exactChord = page.locator('[data-testid="score-chord-target"][data-start-beat="1"]');
  await expect(exactChord).toBeVisible({ timeout: 20_000 });
  await activate(exactChord, testInfo.project.name === "mobile");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("코드 근음", { exact: true }).selectOption("G");
  await dialog.getByLabel("코드 종류", { exact: true }).selectOption("7");
  await dialog.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.find((event: { startBeat: number }) => event.startBeat === 1)?.symbol)).toBe("G7");
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.find((event: { startBeat: number }) => event.startBeat === 1)?.symbol)).toBe("G7");
});

test("저장된 악보의 코드를 직접 바꾸고 TAB를 일반 악보 아래에 추가한다", async ({ page }, testInfo) => {
  const id = await createScoreViaKeys(page);
  await page.getByRole("button", { name: "음표 편집", exact: true }).click();
  await activate(page.getByTestId("score-chord-target").first(), testInfo.project.name === "mobile");
  const dialog = page.getByRole("dialog", { name: "코드 변경", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("코드 근음", { exact: true }).selectOption("G");
  await dialog.getByLabel("코드 종류", { exact: true }).selectOption("7");
  await dialog.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await savedScores(page)).find((score) => score.id === id)?.chords.find((event) => event.startBeat === 0)?.symbol).toBe("G7");
  await activate(page.locator(".score-sheet:visible .vf-stavenote .vf-notehead").nth(1), testInfo.project.name === "mobile");
  await expect(page.getByLabel("코드 근음", { exact: true })).toBeVisible();
  await page.getByLabel("코드 근음", { exact: true }).selectOption("F");
  await page.getByLabel("코드 종류", { exact: true }).selectOption("m7");
  await page.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await expect.poll(async () => (await savedScores(page)).find((score) => score.id === id)?.chords.find((event) => event.startBeat === 1)?.symbol).toBe("Fm7");
  await page.screenshot({ path: `.nomad/task-024-note-editor-${testInfo.project.name}.png`, fullPage: false });
  await page.getByRole("button", { name: "편집 도구 닫기", exact: true }).click();
  await page.getByRole("button", { name: "TAB", exact: true }).click();
  const tab = page.getByRole("region", { name: "TAB 악보", exact: true });
  await expect(tab).toBeVisible();
  await expect(tab.getByTestId("tab-note")).toHaveCount(3);
  await expect(page.locator(".score-sheet:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "피아노", exact: true }).click();
  await expect(tab).toHaveCount(0);
  await page.reload();
  expect((await savedScores(page)).find((score) => score.id === id)?.chords[0]?.symbol).toBe("G7");
});
