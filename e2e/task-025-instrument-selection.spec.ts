import type { Page } from "@playwright/test";
import { expect, openKeysInput, test } from "./fixtures";

async function expectDraftInstrument(page: Page, instrument: string) {
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("humscore.keysDraft") ?? "null")?.instrument)).toBe(instrument);
}

async function capture(page: Page, width: number, mode: string) {
  await expect(page.getByText("악보 그리는 중…", { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.nomad/task-025/${width}-${mode}.png`, fullPage: true });
}

for (const width of [390, 900, 1440]) {
  test(`${width}px 악기 선택 단계·음색 복원·5현 TAB·드럼 음표를 확인한다`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1000 });
    await openKeysInput(page);
    const mode = page.getByLabel("악기 선택", { exact: true });
    await expect(page.getByRole("heading", { name: "피아노로 악보생성", exact: true })).toBeVisible();
    await expect(mode.locator("option")).toHaveText(["피아노", "기타TAB", "드럼", "오케스트라"]);
    const pianoType = page.getByLabel("피아노 종류 선택", { exact: true });
    await expect(pianoType.locator("option")).toHaveText(["피아노", "일렉피아노", "신디사이저 악기"]);
    // 실제 음표가 있는 초안을 만들어 새로고침 시 선택한 음색도 복원되는지 확인한다.
    await page.keyboard.press("a");
    await expectDraftInstrument(page, "piano");
    for (const preset of [
      { category: "acoustic", count: 3, instrument: "uprightPiano", label: "업라이트 피아노" },
      { category: "electric", count: 10, instrument: "epChorus", label: "코러스 EP" },
      { category: "synth", count: 14, instrument: "texturePad", label: "텍스처 패드" },
    ]) {
      await pianoType.selectOption(preset.category);
      const details = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "음색 프리셋" }) });
      if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
      const buttons = details.getByRole("button");
      await expect(buttons).toHaveCount(preset.count);
      await details.getByRole("button", { name: preset.label, exact: true }).click();
      await expectDraftInstrument(page, preset.instrument);
      await page.reload();
      await expect(mode).toHaveValue("piano");
      await expect(pianoType).toHaveValue(preset.category);
      await expect(page.locator("summary").filter({ hasText: "음색 프리셋" })).toContainText(preset.label);
    }
    await page.locator("summary").filter({ hasText: "음색 프리셋" }).click();
    await capture(page, width, "piano");

    await mode.selectOption("guitarTab");
    await expect(page.getByRole("heading", { name: "기타TAB로 악보생성", exact: true })).toBeVisible();
    const sound = page.getByLabel("음색 선택", { exact: true });
    await expect(sound.locator("option")).toHaveText(["통기타", "일렉기타", "클래식 기타", "베이스기타(4현)", "베이스기타(5현)"]);
    await sound.selectOption("bassGuitar5");
    const fretboard = page.getByRole("region", { name: "베이스 기타 지판", exact: true });
    await expect(fretboard.locator("button[data-string][data-fret]")).toHaveCount(35);
    const tab = page.getByRole("region", { name: "TAB 악보", exact: true });
    await expect(tab).toContainText("5현 표준 튜닝");
    // 각 시스템의 직접 자식 g 중 튜닝명과 수평선이 있는 다섯 줄을 센다.
    await expect(tab.getByTestId("tab-system").first().locator(":scope > g:not([data-testid]) > line")).toHaveCount(5);
    await expectDraftInstrument(page, "bassGuitar5");
    await capture(page, width, "bass5");
    await page.reload();
    await expect(mode).toHaveValue("guitarTab");
    await expect(sound).toHaveValue("bassGuitar5");

    await mode.selectOption("orchestra");
    await expect(page.getByRole("heading", { name: "오케스트라로 악보생성", exact: true })).toBeVisible();
    const group = page.getByLabel("악기군 선택", { exact: true });
    await expect(group.locator("option")).toHaveText(["현악", "목관", "금관", "팀파니", "타악기", "하프"]);
    for (const entry of [
      ["strings", "violin"], ["woodwinds", "flute"], ["brass", "frenchHorn"],
      ["timpani", "timpani"], ["percussion", "orchestralSnare"], ["harp", "harp"],
    ]) {
      await group.selectOption(entry[0]);
      await expect(sound).toHaveValue(entry[1]);
      await expectDraftInstrument(page, entry[1]);
    }
    await capture(page, width, "orchestra");
    await page.reload();
    await expect(mode).toHaveValue("orchestra");
    await expect(group).toHaveValue("harp");
    await expect(sound).toHaveValue("harp");

    await mode.selectOption("drums");
    await page.getByRole("button", { name: "새 악보로 시작", exact: true }).click();
    await expect(mode).toHaveValue("drums");
    await expect(page.getByRole("heading", { name: "드럼으로 악보생성", exact: true })).toBeVisible();
    const legend = page.getByLabel("드럼 음표 안내", { exact: true });
    await expect(legend).toBeVisible();
    await expect(legend.getByRole("listitem")).toHaveCount(11);
    await expect(page.getByLabel("음색 선택", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "베이스드럼 1마디 1박", exact: true }).click();
    await page.getByRole("button", { name: "닫힌 하이햇 1마디 1박", exact: true }).click();
    await expect(page.getByText("2개 타격 · 1마디 · 선택한 칸만 다시 누르면 삭제됩니다.", { exact: true })).toBeVisible();
    await expectDraftInstrument(page, "drumKit");
    await expect(page.getByText("악보 그리는 중…", { exact: true })).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator(".score-sheet .vf-stavenote .vf-notehead").nth(1)).toBeVisible();
    await capture(page, width, "drums");
    await page.reload();
    await expect(mode).toHaveValue("drums");
    await expect(page.getByRole("button", { name: "베이스드럼 1마디 1박", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}
