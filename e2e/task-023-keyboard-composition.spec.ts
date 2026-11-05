import type { Page } from "@playwright/test";
import type { Score } from "../src/lib/music/types";
import { holdNote, createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";

async function storedScore(page: Page, id: string): Promise<Score> {
  return page.evaluate((scoreId) => {
    const scores = JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]");
    return scores.find((score: { id: string }) => score.id === scoreId);
  }, id);
}

async function openEmptySavedComposer(page: Page): Promise<string> {
  const id = await createScoreViaKeys(page);
  await page.evaluate((scoreId) => {
    const scores = JSON.parse(localStorage.getItem("humscore.scores.v1") ?? "[]") as Score[];
    localStorage.setItem("humscore.scores.v1", JSON.stringify(scores.map((score) => score.id === scoreId ? { ...score, notes: [], chords: [] } : score)));
  }, id);
  await page.reload();
  await page.getByRole("button", { name: "작곡", exact: true }).click();
  return id;
}

test("악보생성 문구와 BPM 아래 코드 수정은 새로고침·악보 저장 후에도 유지된다", async ({ page }) => {
  await openKeysInput(page);
  await expect(page.getByRole("heading", { name: "피아노로 악보생성", exact: true })).toBeVisible();
  for (const key of ["a", "s", "d", "f"]) await holdNote(page, key);
  await page.getByRole("button", { name: "입력 마치기", exact: true }).click();
  await page.getByRole("button", { name: "악보 편집", exact: true }).click();
  const section = page.getByRole("region", { name: "코드수정하기", exact: true });
  await expect(section.getByRole("button", { name: "코드수정하기", exact: true })).toHaveAttribute("aria-expanded", "true");
  const bpm = await page.getByLabel("BPM", { exact: true }).boundingBox();
  const sectionBox = await section.boundingBox();
  expect(sectionBox!.y).toBeGreaterThan(bpm!.y);
  const editor = page.locator("#keys-chord-editor");
  await editor.getByRole("button", { name: /^1\s/ }).click();
  await editor.getByText("근음", { exact: true }).locator("..").getByRole("button", { name: "F", exact: true }).click();
  await editor.locator('[data-slot="card"]').getByRole("button", { name: "적용", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.[0]?.symbol)).toBe("F");
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.chords?.[0]?.symbol)).toBe("F");
  await page.getByRole("button", { name: "악보로 저장", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  const id = page.url().split("/scores/")[1];
  expect((await storedScore(page, id)).chords[0]).toEqual({ startBeat: 0, symbol: "F" });
});

test("작곡 2-5-1 후보를 저장하기로 확정하면 새로고침 후에도 8마디와 코드가 남는다", async ({ page }) => {
  const id = await openEmptySavedComposer(page);
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "저장하기", exact: true });
  await expect(save).toBeDisabled();
  const existing = dialog.getByRole("checkbox", { name: "현재 악보의 코드 진행 사용", exact: true });
  if (await existing.isChecked()) await existing.uncheck();
  await dialog.getByLabel("작곡 코드 진행", { exact: true }).selectOption("two-five-one");
  await expect(dialog.getByLabel("작곡 코드 진행", { exact: true }).locator("option:checked")).toContainText("2-5-1");
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await expect(save).toBeEnabled();
  expect((await storedScore(page, id)).notes).toHaveLength(0);
  await save.click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".score-sheet svg .vf-measure")).toHaveCount(8, { timeout: 20_000 });
  const saved = await storedScore(page, id);
  expect(saved.chords.map((chord) => chord.symbol)).toEqual(["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Cmaj7"]);
  expect(saved.notes.at(-1)!.startBeat + saved.notes.at(-1)!.durationBeats).toBe(32);
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(async () => {
    const boxes = await page.locator(".score-sheet svg .vf-measure").evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      const staff = element.querySelector(":scope > path")!.getBoundingClientRect();
      return { x: box.x, y: staff.y, right: box.right };
    }));
    expect(boxes).toHaveLength(8);
    // 음자리표·높은 음표가 있는 group 전체 대신 오선 path로 줄의 높이를 비교한다.
    for (const start of [0, 4]) {
      for (let i = start + 1; i < start + 4; i++) expect(Math.abs(boxes[i].y - boxes[start].y)).toBeLessThan(12);
    }
    expect(boxes[4].y).toBeGreaterThan(boxes[0].y + 20);
    expect(Math.abs(boxes[7].right - boxes[3].right)).toBeLessThan(5);
  }).toPass({ timeout: 15_000 });
});

test("작곡 저장 실패는 후보 창을 유지하고 다시 저장할 수 있다", async ({ page }) => {
  const id = await openEmptySavedComposer(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("작곡 마디 수", { exact: true }).fill("5");
  await dialog.getByRole("button", { name: "멜로디 후보 만들기", exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "humscore.scores.v1") throw new DOMException("저장 공간 부족", "QuotaExceededError");
      return original.call(this, key, value);
    };
    (window as unknown as { restoreScoreStorage: () => void }).restoreScoreStorage = () => { Storage.prototype.setItem = original; };
  });
  await dialog.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "저장하기", exact: true })).toBeEnabled();
  expect((await storedScore(page, id)).notes).toHaveLength(0);
  await page.evaluate(() => (window as unknown as { restoreScoreStorage: () => void }).restoreScoreStorage());
  await dialog.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const measures = page.locator(".score-sheet svg .vf-measure");
  await expect(measures).toHaveCount(5, { timeout: 20_000 });
  await expect(async () => {
    const boxes = await measures.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      const staff = element.querySelector(":scope > path")!.getBoundingClientRect();
      return { x: box.x, y: staff.y, right: box.right };
    }));
    expect(boxes[4].y).toBeGreaterThan(boxes[0].y + 20);
    expect(Math.abs(boxes[4].x - boxes[0].x)).toBeLessThan(5);
    expect(Math.abs(boxes[4].right - boxes[3].right)).toBeLessThan(5);
  }).toPass({ timeout: 15_000 });
});

test("8마디 악보는 세 화면 크기에서 4마디씩 두 줄이며 두 번째 줄도 폭을 채운다", async ({ page }, testInfo) => {
  await openKeysInput(page);
  const measures = page.locator(".score-sheet svg .vf-measure");
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(measures).toHaveCount(8, { timeout: 20_000 });
    await expect(async () => {
      const boxes = await measures.evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        const staff = element.querySelector(":scope > path")!.getBoundingClientRect();
        return { x: box.x, y: staff.y, right: box.right, width: box.width };
      }));
      for (const start of [0, 4]) {
        for (let i = start + 1; i < start + 4; i++) expect(Math.abs(boxes[i].y - boxes[start].y)).toBeLessThan(5);
      }
      expect(boxes[4].y).toBeGreaterThan(boxes[0].y + 20);
      expect(Math.abs(boxes[7].right - boxes[3].right)).toBeLessThan(5);
      expect(Math.abs(boxes[4].x - boxes[0].x)).toBeLessThan(5);
      const paper = await page.locator(".score-sheet").boundingBox();
      expect(Math.abs(paper!.x + paper!.width - boxes[7].right)).toBeLessThan(35);
    }).toPass({ timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.nomad/task-023-layout-${testInfo.project.name}-${width}.png`, fullPage: true });
  }
});
