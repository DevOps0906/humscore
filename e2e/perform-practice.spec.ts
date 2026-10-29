import type { Locator, Page } from "@playwright/test";
import { createScoreViaKeys, createScoreWithNotes, expect, test } from "./fixtures";

/**
 * 공연 모드 연습 재생 (task-002, docs/specs/task-002-perform-boost.md 7장 A6·A7·A8)
 * 헤드리스에서는 소리를 확인할 수 없으므로 상태 문구·aria 속성·커서(DOM)·속도 표시로 판정한다.
 * 악보: /keys 에서 A,S,D 3음(♩=90, 1마디).
 */

const bar = (page: Page) => page.locator('[role="group"][aria-label="연습 재생"]');
const statusLine = (page: Page) => bar(page).locator('p[role="status"]');
const playBtn = (page: Page) => bar(page).getByRole("button", { name: "재생", exact: true });
const pauseBtn = (page: Page) => bar(page).getByRole("button", { name: "일시정지", exact: true });
const followBtn = (page: Page) => page.getByRole("button", { name: "따라 치기", exact: true });
const cursorMark = (page: Page) => page.getByTestId("score-cursor");

async function openPerform(page: Page): Promise<string> {
  const id = await createScoreViaKeys(page);
  await page.goto(`/scores/${id}/perform`);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  await expect(playBtn(page)).toBeEnabled();
  return id;
}

/** 모바일(~767)은 구간·반복이 접혀 있으므로 펼친다 */
async function openRange(page: Page) {
  const t = bar(page).getByRole("button", { name: "구간 반복 설정" });
  if (await t.isVisible()) {
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
  }
}

async function setRate(page: Page, pct: number) {
  const speed = bar(page).locator("output");
  for (let i = 0; i < 6; i++) {
    const cur = Number((await speed.innerText()).match(/속도 (\d+)%/)![1]);
    if (cur === pct) return;
    await bar(page).getByRole("button", { name: cur > pct ? "느리게" : "빠르게" }).click();
    await expect(speed).not.toContainText(`속도 ${cur}%`);
  }
  await expect(speed).toContainText(`속도 ${pct}%`);
}

const left = (l: Locator) => l.evaluate((el) => parseFloat((el as HTMLElement).style.left));

test.describe("공연 모드 연습 재생", () => {
  test("속도: 기본 100%, 70%에서 ♩=63, 50%·100% 경계에서 버튼 비활성", async ({ page }) => {
    await openPerform(page);
    const speed = bar(page).locator("output");
    await expect(speed).toHaveAttribute("aria-live", "polite");
    await expect(speed).toContainText("속도 100%");
    await expect(speed).toContainText("♩=90");
    await expect(bar(page).getByRole("button", { name: "빠르게" })).toBeDisabled();

    await setRate(page, 70);
    await expect(speed).toContainText("♩=63");

    await setRate(page, 50);
    await expect(speed).toContainText("♩=45");
    await expect(bar(page).getByRole("button", { name: "느리게" })).toBeDisabled();
    await expect(bar(page).getByRole("button", { name: "빠르게" })).toBeEnabled();
  });

  test("재생 → 커서 이동 → 일시정지(커서 유지) → 처음으로 / 끝나면 대기로", async ({ page }) => {
    await openPerform(page);
    await expect(cursorMark(page)).toHaveCount(0); // 대기: 커서 없음
    await setRate(page, 50); // 3박 @ ♩=45 ≈ 4초

    await playBtn(page).click();
    await expect(pauseBtn(page)).toBeVisible();
    await expect(cursorMark(page)).toBeVisible();
    const first = await left(cursorMark(page));
    await expect.poll(() => left(cursorMark(page)), { timeout: 5_000 }).toBeGreaterThan(first);

    await pauseBtn(page).click();
    await expect(playBtn(page)).toBeVisible();
    await expect(cursorMark(page)).toBeVisible(); // 일시정지: 멈춘 음에 커서 유지
    const paused = await left(cursorMark(page));
    await page.waitForTimeout(1_500);
    expect(await left(cursorMark(page))).toBe(paused);

    // 재개 후 끝까지 → 반복 꺼짐이면 정지(대기), 커서 사라짐
    await playBtn(page).click();
    await expect(pauseBtn(page)).toBeVisible();
    await expect(playBtn(page)).toBeVisible({ timeout: 8_000 });
    await expect(cursorMark(page)).toHaveCount(0);
    await expect(statusLine(page)).toHaveText("");
  });

  test("구간 반복: 반복 켜기 → aria-pressed, 재생 중 '반복 1–1 마디' 배지, 끝나도 계속 재생", async ({ page }) => {
    await openPerform(page);
    await openRange(page);
    await expect(bar(page).getByRole("combobox", { name: "구간 시작 마디" })).toHaveValue("1");
    await expect(bar(page).getByRole("combobox", { name: "구간 끝 마디" })).toHaveValue("1");
    const loop = bar(page).getByRole("button", { name: /반복 (켜짐|꺼짐)/ });
    await expect(loop).toHaveAttribute("aria-pressed", "false");
    await loop.click();
    await expect(loop).toHaveAttribute("aria-pressed", "true");
    await expect(loop).toContainText("반복 켜짐");

    await playBtn(page).click();
    await expect(statusLine(page)).toHaveAttribute("aria-live", "polite");
    await expect(statusLine(page)).toContainText("반복 1–1 마디");
    // 3박 @ ♩=90 = 2초. 반복이면 그 뒤에도 재생 중이어야 한다
    await page.waitForTimeout(3_500);
    await expect(pauseBtn(page)).toBeVisible();
    await expect(statusLine(page)).toContainText("반복 1–1 마디");

    await pauseBtn(page).click();
    await expect(statusLine(page)).not.toContainText("반복 1–1 마디");
  });

  test("구간 2–3 마디: 반복 배지, 시작>끝 선택은 반대쪽 값이 보정된다", async ({ page }) => {
    const id = await createScoreWithNotes(page, 12);
    await page.goto(`/scores/${id}/perform`);
    await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
    await openRange(page);
    const start = bar(page).getByRole("combobox", { name: "구간 시작 마디" });
    const end = bar(page).getByRole("combobox", { name: "구간 끝 마디" });
    await expect(start.locator("option")).toHaveCount(3);
    await expect(end).toHaveValue("3"); // 기본 B = 마지막 마디

    await start.selectOption("2");
    await expect(start).toHaveValue("2");
    await expect(end).toHaveValue("3");
    await bar(page).getByRole("button", { name: /반복 (켜짐|꺼짐)/ }).click();
    await playBtn(page).click();
    await expect(statusLine(page)).toContainText("반복 2–3 마디");
    await pauseBtn(page).click();

    // 끝을 시작보다 작게 → 시작이 끝으로 내려온다
    await end.selectOption("1");
    await expect(end).toHaveValue("1");
    await expect(start).toHaveValue("1");
    // 시작을 끝보다 크게 → 끝이 시작으로 올라간다 (A>B 상태가 생기지 않음)
    await start.selectOption("3");
    await expect(start).toHaveValue("3");
    await expect(end).toHaveValue("3");
  });

  test("A6: 따라 치기 켜면 재생 정지·연습 바 비활성, 끄면 대기로 복귀", async ({ page }) => {
    await openPerform(page);
    await setRate(page, 50);
    await playBtn(page).click();
    await expect(pauseBtn(page)).toBeVisible();

    await followBtn(page).click();
    await expect(followBtn(page)).toHaveAttribute("aria-pressed", "true");
    await expect(bar(page)).toHaveAttribute("aria-disabled", "true");
    await expect(statusLine(page)).toHaveText("따라 치기 중에는 재생할 수 없어요");
    await expect(bar(page).getByRole("button", { name: "재생", exact: true, includeHidden: true })).toBeDisabled();
    await expect(bar(page).getByRole("button", { name: "일시정지", exact: true, includeHidden: true })).toHaveCount(0);
    for (const name of ["처음으로", "느리게", "빠르게"])
      await expect(bar(page).getByRole("button", { name, includeHidden: true })).toBeDisabled();

    const viewport = page.viewportSize()!;
    if (viewport.width < 768) {
      // 모바일: 연습 바 자리를 FollowPanel 이 쓴다
      await expect(bar(page)).toBeHidden();
    } else {
      await expect(bar(page)).toBeVisible();
    }

    await followBtn(page).click();
    await expect(followBtn(page)).toHaveAttribute("aria-pressed", "false");
    await expect(bar(page)).not.toHaveAttribute("aria-disabled", "true");
    await expect(playBtn(page)).toBeEnabled();
    await expect(statusLine(page)).toHaveText("");
    // 따라 치기 전 재생은 이어지지 않는다
    await page.waitForTimeout(500);
    await expect(playBtn(page)).toBeVisible();
  });

  test("A7: 따라 치기 패널과 연습 바가 겹치지 않는다", async ({ page }) => {
    await openPerform(page);
    await followBtn(page).click();
    const aside = page.getByRole("complementary", { name: "따라 치기" });
    await expect(aside).toBeVisible();
    if (!(await bar(page).isVisible())) return; // 모바일: 연습 바 숨김(겹칠 수 없음)
    const a = (await aside.boundingBox())!;
    const b = (await bar(page).boundingBox())!;
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap, `aside=${JSON.stringify(a)} bar=${JSON.stringify(b)}`).toBe(false);
  });

  test("A7 준비·오류: 오디오가 켜지지 않으면 '소리 준비 중…' → 3초 뒤 오류 문구, 대기로 복귀", async ({ page }) => {
    const id = await createScoreViaKeys(page);
    // 가짜 AudioContext: 항상 suspended (resume 무시) → statechange 가 오지 않는다
    await page.addInitScript(() => {
      Object.defineProperty(BaseAudioContext.prototype, "state", { get: () => "suspended", configurable: true });
      AudioContext.prototype.resume = () => Promise.resolve();
    });
    await page.goto(`/scores/${id}/perform`);
    await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

    await playBtn(page).click();
    await expect(statusLine(page)).toHaveText("소리 준비 중…");
    await expect(pauseBtn(page)).toBeVisible();
    await expect(statusLine(page)).toHaveText("소리를 켜지 못했어요. 다시 눌러 주세요", { timeout: 5_000 });
    await expect(playBtn(page)).toBeEnabled();
    await expect(cursorMark(page)).toHaveCount(0);
  });

  test("A7 비어 있음: 음표 0개면 연습 바 비활성 + 안내 문구", async ({ page }) => {
    const id = await createScoreViaKeys(page);
    await page.evaluate((sid) => {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("humscore.scores.")) continue;
        try {
          const list = JSON.parse(localStorage.getItem(k)!);
          if (!Array.isArray(list)) continue;
          for (const s of list) if (s?.id === sid) s.notes = [];
          localStorage.setItem(k, JSON.stringify(list));
        } catch {
          /* 다른 형식 키 무시 */
        }
      }
    }, id);
    await page.goto(`/scores/${id}/perform`);
    await expect(bar(page)).toHaveAttribute("aria-disabled", "true");
    await expect(statusLine(page)).toHaveText("음표가 없어 재생할 수 없어요");
    await expect(playBtn(page)).toBeDisabled();
  });
});
