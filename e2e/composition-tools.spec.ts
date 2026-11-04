import type { Page } from "@playwright/test";
import type { Score } from "../src/lib/music/types";
import { expect, openKeysInput, test } from "./fixtures";

async function createScoreViaKeys(page: Page): Promise<string> {
  // 새 작곡 버튼이 헤더를 넓혀 모바일 클릭 좌표를 어긋나게 했던 회귀를 먼저 검증한다.
  await openKeysInput(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const key of ["a", "s", "d"]) await page.keyboard.press(key);
  await expect(page.getByText("3개 음표")).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  return page.url().split("/scores/")[1];
}

async function storedScore(page: Page, id: string): Promise<Score> {
  return page.evaluate((scoreId) => {
    const scores = JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]");
    return scores.find((score: { id: string }) => score.id === scoreId);
  }, id);
}

async function addVerse(page: Page, verse: number, text: string) {
  await page.getByRole("button", { name: "가사 등록", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("가사 절", { exact: true }).selectOption(String(verse));
  await dialog.getByRole("textbox").fill(text);
  await dialog.getByRole("button", { name: "적용", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);
  // 기기 안 음성 인식과 무관한 직접 입력 회귀이며 실제 마이크·서버 인식을 사용하지 않는다.
  await page.addInitScript(() => {
    const target = window as unknown as Record<string, unknown>;
    delete target.SpeechRecognition;
    delete target.webkitSpeechRecognition;
  });
});

test("절별 가사: 1·2·3절 공존, 선택한 절만 삭제, 새로고침과 인쇄용 SVG 유지", async ({ page }) => {
  const id = await createScoreViaKeys(page);
  await addVerse(page, 1, "가나다");
  await addVerse(page, 2, "라마바");
  await addVerse(page, 3, "사아자");
  const sheet = page.locator(".score-sheet svg").first();
  for (const verse of [1, 2, 3]) await expect(sheet.locator("text").filter({ hasText: `(${verse}절)` }).first()).toBeAttached();
  const before = await storedScore(page, id);
  expect(before.notes[0].lyrics).toEqual({ "1": "가", "2": "라", "3": "사" });
  await page.getByRole("button", { name: "가사 등록", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("가사 절", { exact: true }).selectOption("2");
  await expect(dialog.getByRole("textbox")).toHaveValue("라 마 바");
  await dialog.getByRole("button", { name: "(2절) 가사 지우기", exact: true }).click();
  await page.reload();
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await expect(sheet.locator("text").filter({ hasText: "(1절)" }).first()).toBeAttached();
  await expect(sheet.locator("text").filter({ hasText: "(3절)" }).first()).toBeAttached();
  await expect(sheet.locator("text").filter({ hasText: "(2절)" })).toHaveCount(0);
  const after = await storedScore(page, id);
  expect(after.notes.map((note) => note.lyric)).toEqual(before.notes.map((note) => note.lyric));
  expect(after.notes[0].lyrics).toEqual({ "1": "가", "3": "사" });
});

test("선택 음표 코드: 마디 중간의 정확한 위치·전조·잘못된 입력·삭제", async ({ page }) => {
  const id = await createScoreViaKeys(page);
  await page.getByRole("button", { name: "음표 편집", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("cursor-live")).toContainText("2번째 음표");
  const input = page.getByLabel("선택 음표 코드", { exact: true });
  await input.fill("틀린 코드");
  await expect(page.getByRole("button", { name: "음표에 코드 적용", exact: true })).toBeDisabled();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("F#m7");
  await page.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  await expect.poll(async () => (await storedScore(page, id)).chords.find((chord) => chord.startBeat === 1)?.symbol).toBe("F#m7");
  const sheet = page.locator(".score-sheet svg").first();
  const harmony = sheet.locator("text").filter({ hasText: /^F/ }).first();
  await expect(harmony).toBeAttached({ timeout: 20_000 });
  await expect(async () => {
    const harmonyBox = await harmony.boundingBox();
    const firstNoteBox = await sheet.locator(".vf-notehead").first().boundingBox();
    expect(harmonyBox!.x).toBeGreaterThan(firstNoteBox!.x + 5);
  }).toPass();
  await page.getByRole("button", { name: "반음 올리기", exact: true }).click();
  await expect(input).toHaveValue("Gm7");
  await page.getByRole("button", { name: "음표에 코드 적용", exact: true }).click();
  expect((await storedScore(page, id)).chords.find((chord) => chord.startBeat === 1)?.symbol).toBe("F#m7");
  await page.getByRole("button", { name: "음표 코드 삭제", exact: true }).click();
  await expect.poll(async () => (await storedScore(page, id)).chords.filter((chord) => chord.startBeat === 1).length).toBe(0);
});

test("작곡: 후보는 저장하지 않고, 2마디 추가·되돌리기·명시적 교체·복원", async ({ page }) => {
  const id = await createScoreViaKeys(page);
  await addVerse(page, 2, "가나다");
  const original = await storedScore(page, id);
  await page.getByRole("button", { name: "작곡", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("작곡 마디 수", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await expect(dialog.locator(".score-sheet svg").first()).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "후보 미리듣기", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "미리듣기 중지", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "미리듣기 중지", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "후보 미리듣기", exact: true })).toBeVisible();
  expect((await storedScore(page, id)).notes).toEqual(original.notes);
  await dialog.getByRole("button", { name: "멜로디 적용", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const added = await storedScore(page, id);
  expect(added.notes.slice(0, original.notes.length)).toEqual(original.notes);
  expect(added.notes[original.notes.length].startBeat).toBe(4);
  expect(Math.max(...added.notes.map((note) => note.startBeat + note.durationBeats))).toBe(12);
  await page.getByRole("button", { name: "작곡·리하모니 되돌리기", exact: true }).click();
  await expect.poll(async () => (await storedScore(page, id)).notes).toEqual(original.notes);
  await page.getByRole("button", { name: "작곡", exact: true }).click();
  await dialog.getByLabel("작곡 마디 수", { exact: true }).fill("2");
  await dialog.getByLabel("멜로디 적용 위치", { exact: true }).selectOption("replace");
  await expect(dialog.getByText(/기존 음표·가사·셈여림·진행 기호를 새 멜로디로 바꿔요/)).toBeVisible();
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await dialog.getByRole("button", { name: "기존 음표를 바꾸고 적용", exact: true }).click();
  await page.reload();
  await expect(page.locator(".score-sheet svg .vf-measure")).toHaveCount(2, { timeout: 20_000 });
  const replaced = await storedScore(page, id);
  expect(Math.max(...replaced.notes.map((note) => note.startBeat + note.durationBeats))).toBe(8);
  expect(replaced.notes.some((note) => note.lyric || note.lyrics)).toBe(false);
});

test("리하모니제이션: 후보 비교·코드만 적용·음표와 절별 가사 보존·되돌리기", async ({ page }) => {
  const id = await createScoreViaKeys(page);
  await addVerse(page, 1, "가나다");
  await addVerse(page, 2, "라마바");
  const original = await storedScore(page, id);
  await page.getByRole("button", { name: "고급 리하모니제이션", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("리하모니제이션 방식", { exact: true }).selectOption("jazz");
  await dialog.getByRole("button", { name: "리하모니 후보 만들기", exact: true }).click();
  await expect(dialog.getByText(/기존 진행:/)).toBeVisible();
  expect((await storedScore(page, id)).chords).toEqual(original.chords);
  await dialog.getByRole("button", { name: "리하모니 적용", exact: true }).click();
  const after = await storedScore(page, id);
  expect(after.notes).toEqual(original.notes);
  expect(after.chords).not.toEqual(original.chords);
  await page.getByRole("button", { name: "작곡·리하모니 되돌리기", exact: true }).click();
  await expect.poll(async () => (await storedScore(page, id)).chords).toEqual(original.chords);
  expect((await storedScore(page, id)).notes).toEqual(original.notes);
});

test("건반 빈 악보에서 작곡 직접 열기·재열기·3구간 도구 배치", async ({ page }, testInfo) => {
  await openKeysInput(page);
  await page.getByRole("button", { name: "작곡하기", exact: true }).click();
  await expect(page).toHaveURL(/\/keys$/);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "작곡", exact: true })).toBeVisible();
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(dialog.getByLabel("작곡 마디 수", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(dialog).toHaveCSS("display", "grid");
    await page.screenshot({ path: `.nomad/compose-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "작곡하기", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "작곡하기", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "작곡", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
});
