import type { Locator, Page } from "@playwright/test";
import type { Score } from "../src/lib/music/types";
import { confirmChordMisfit, holdNote, createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";

async function savedScores(page: Page): Promise<Score[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]"));
}

async function activate(target: Locator, touch: boolean) {
  if (touch) await target.tap();
  else await target.click();
}

test("작곡하기는 건반에서 바로 열리고 취소·저장·새로고침 뒤 다시 사용해도 악보를 중복 생성하지 않는다", async ({ page }) => {
  await openKeysInput(page);
  await expect(page.getByRole("heading", { name: "피아노로 악보생성", exact: true })).toBeVisible();
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
  const mode = page.getByLabel("악기 선택", { exact: true });
  const instrument = page.getByLabel("음색 선택", { exact: true });
  const tab = page.getByRole("region", { name: "TAB 악보", exact: true });
  await expect(tab).toHaveCount(0);
  await mode.selectOption("guitarTab");
  await expect(instrument.locator("option")).toHaveCount(5);
  for (const value of ["classicalGuitar", "electricGuitar", "acousticGuitar", "bassGuitar"]) {
    await instrument.selectOption(value);
    const bass = value === "bassGuitar";
    const fretboard = page.getByRole("region", { name: bass ? "베이스 기타 지판" : "기타 지판", exact: true });
    await expect(fretboard).toBeVisible();
    await expect(fretboard.locator("button[data-string][data-fret]")).toHaveCount((bass ? 4 : 6) * 7);
    await activate(fretboard.locator('button[data-string="1"][data-fret="0"]'), touch);
  }
  await expect.poll(() => page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null");
    return [draft?.notes?.map((note: { midi: number }) => note.midi), ...draft?.parts?.map((part: { notes: { midi: number }[] }) => part.notes.map((note) => note.midi))];
  })).toEqual([[64], [64], [64], [43]]);
  await expect(tab).toBeVisible();
  await expect(tab.getByRole("heading")).toContainText("베이스");
  await expect(tab.getByTestId("tab-note")).toHaveCount(1);
  // 기타·베이스는 TAB만 기본으로 보이고(task-028), '악보'를 켜야 오선보가 위에 함께 나온다.
  await expect(page.locator(".score-sheet")).toHaveCount(0);
  const staffToggle = page.getByRole("button", { name: "악보", exact: true });
  await staffToggle.click();
  const normal = page.locator(".score-sheet").first();
  const normalBox = await normal.boundingBox();
  const tabBox = await tab.boundingBox();
  expect(tabBox!.y).toBeGreaterThan(normalBox!.y + normalBox!.height - 1);
  await instrument.selectOption("acousticGuitar");
  await expect(tab.getByRole("heading")).toContainText("통기타");
  await staffToggle.click();
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(tab).toBeVisible();
    await expect(normal.getByText("악보 그리는 중…", { exact: true })).toHaveCount(0);
    await expect(normal.locator("svg").first()).toBeVisible();
    if (width >= 900) {
      await expect.poll(() => normal.evaluate((element) => {
        // task-028 페이지 맞춤: 화면 높이에 맞게 비례 축소되므로 폭을 꽉 채우지 않을 수 있다. 넘치지 않고 가운데 놓이면 된다.
        const svg = element.querySelector("svg");
        if (!svg) return false;
        const box = svg.getBoundingClientRect();
        const outer = element.getBoundingClientRect();
        return box.width > 200 && box.width <= outer.width + 1 && Math.abs((box.left - outer.left) - (outer.right - box.right)) < 40;
      })).toBe(true);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.nomad/task-024-guitar-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
  await mode.selectOption("piano");
  await expect(tab).toHaveCount(0);
  await expect(page.getByRole("region", { name: "기타 지판", exact: true })).toHaveCount(0);
  await expect(normal).toHaveCount(1);
});

test("건반 악보 편집에서 음표와 코드 클릭·터치로 옵션을 열어 해당 박의 코드만 고친다", async ({ page }, testInfo) => {
  await openKeysInput(page);
  for (const key of ["a", "s", "d"]) await holdNote(page, key);
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
  await confirmChordMisfit(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const exactChord = page.locator('[data-testid="score-chord-target"][data-start-beat="1"]');
  await expect(exactChord).toBeVisible({ timeout: 20_000 });
  await activate(exactChord, testInfo.project.name === "mobile");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("코드 근음", { exact: true }).selectOption("G");
  await dialog.getByLabel("코드 종류", { exact: true }).selectOption("7");
  await dialog.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await confirmChordMisfit(page);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.find((event: { startBeat: number }) => event.startBeat === 1)?.symbol)).toBe("G7");
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.find((event: { startBeat: number }) => event.startBeat === 1)?.symbol)).toBe("G7");
});

test("저장된 악보의 코드를 직접 바꾸고, 피아노 악보에는 TAB 토글이 없다", async ({ page }, testInfo) => {
  const id = await createScoreViaKeys(page);
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await page.getByRole("button", { name: "음표 편집", exact: true }).click();
  await activate(page.getByTestId("score-chord-target").first(), testInfo.project.name === "mobile");
  const dialog = page.getByRole("dialog", { name: "코드 변경", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("코드 근음", { exact: true }).selectOption("G");
  await dialog.getByLabel("코드 종류", { exact: true }).selectOption("7");
  await dialog.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await confirmChordMisfit(page);
  await page.keyboard.press("Escape");
  // 대화상자가 닫혀 초안에 반영된 뒤 적용해야 저장된다(닫히는 중에 누르면 이전 초안이 저장될 수 있다).
  await expect(dialog).toHaveCount(0);
  const applyButton = page.getByRole("group", { name: "악보 편집 적용과 저장", exact: true }).getByRole("button", { name: "적용", exact: true });
  await expect(async () => {
    await applyButton.click();
    expect((await savedScores(page)).find((score) => score.id === id)?.chords.find((event) => event.startBeat === 0)?.symbol).toBe("G7");
  }).toPass({ timeout: 10_000 });
  await activate(page.locator(".score-sheet:visible .vf-stavenote .vf-notehead").nth(1), testInfo.project.name === "mobile");
  await expect(page.getByLabel("코드 근음", { exact: true })).toBeVisible();
  await page.getByLabel("코드 근음", { exact: true }).selectOption("F");
  await page.getByLabel("코드 종류", { exact: true }).selectOption("m7");
  await page.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await confirmChordMisfit(page);
  await expect(async () => {
    await applyButton.click();
    expect((await savedScores(page)).find((score) => score.id === id)?.chords.find((event) => event.startBeat === 1)?.symbol).toBe("Fm7");
  }).toPass({ timeout: 10_000 });
  await page.screenshot({ path: `.nomad/task-024-note-editor-${testInfo.project.name}.png`, fullPage: false });
  await page.getByRole("button", { name: "편집 도구 닫기", exact: true }).click();
  // TAB 보기는 task-028부터 기타·베이스 파트에서만 제공한다.
  await expect(page.getByRole("button", { name: "TAB", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "TAB 악보", exact: true })).toHaveCount(0);
  await expect(page.locator(".score-sheet:visible")).toHaveCount(1);
  await page.reload();
  expect((await savedScores(page)).find((score) => score.id === id)?.chords[0]?.symbol).toBe("G7");
});
