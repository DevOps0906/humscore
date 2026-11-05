import { holdNote, createScoreViaKeys, expect, openKeysInput, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function enterEditMode(page: Page) {
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  const toggle = page.getByRole("button", { name: "음표 편집" });
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await expect(async () => {
    if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
  await expect(page.getByTestId("cursor-live")).toBeAttached();
}

/** n번째(0부터) 음표 머리의 화면 중심 */
async function noteCenter(page: Page, n: number) {
  const note = page.locator(".score-sheet:visible .vf-stavenote .vf-notehead").nth(n);
  await note.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  const head = (await note.boundingBox())!;
  return { x: head.x + head.width / 2, y: head.y + head.height / 2 };
}

test("터치/클릭: 음표를 누르면 도구 모음이 뜨고 반음·음가·삭제 등이 동작", async ({ page, isMobile }) => {
  await createScoreViaKeys(page);
  await enterEditMode(page);
  const live = page.getByTestId("cursor-live");
  const toolbar = page.getByTestId("score-toolbar");

  const tap = async (n: number) => {
    await expect(async () => {
      const c = await noteCenter(page, n);
      if (isMobile) await page.touchscreen.tap(c.x, c.y);
      else await page.mouse.click(c.x, c.y);
      await expect(live).toContainText(`${n + 1}번째 음표`, { timeout: 1500 });
      await expect(toolbar).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15_000 });
  };

  await tap(0);
  await expect(toolbar).toBeVisible();
  const before = (await live.textContent())!;
  await toolbar.getByRole("button", { name: "반음 올림" }).click();
  await expect(live).not.toHaveText(before);
  await toolbar.getByRole("button", { name: "반음 내림" }).click();
  await expect(live).toHaveText(before);

  await toolbar.getByRole("button", { name: "8분", exact: true }).click();
  await expect(live).toContainText("8분음표");

  // 다른 음표로 이동하면 앞 음과의 음정 표시
  await tap(1);
  await expect(toolbar).toContainText("앞 음과");

  // 빈 곳을 누르면 도구 모음만 닫힘 (선택 유지)
  // 편집 바·악기 패널이 위에 쌓여 왼쪽 위 모서리가 화면 하단 고정 막대에 가려질 수 있다.
  // 편집 영역을 화면 가운데로 옮기고, 음표가 없는 왼쪽 여백 중 가려지지 않은 점을 누른다.
  const editor = page.getByRole("application", { name: /악보 편집/ });
  await editor.evaluate((element) => element.scrollIntoView({ block: "center" }));
  // 도구 모음은 스크롤 뒤 위치를 다시 잡는다(모바일에서는 화면 폭 대부분을 덮음). 자리 잡은 뒤 그 영역 밖을 고른다.
  await page.waitForTimeout(500);
  const blank = await editor.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const covers = [...document.querySelectorAll('[data-testid="score-toolbar"]')].map((node) => (node.closest(".no-print.absolute") ?? node).getBoundingClientRect());
    const covered = (x: number, y: number) => covers.some((r) => x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8);
    const x = box.left + 6;
    for (let y = Math.max(box.top + 6, 80); y < Math.min(box.bottom, innerHeight - 160); y += 8) {
      const hit = document.elementFromPoint(x, y);
      if (hit && element.contains(hit) && !covered(x, y) && !hit.closest(".no-print.absolute")) return { x, y };
    }
    return null;
  });
  expect(blank).not.toBeNull();
  if (isMobile) await page.touchscreen.tap(blank!.x, blank!.y);
  else await page.mouse.click(blank!.x, blank!.y);
  await expect(toolbar).toHaveCount(0);
  await expect(live).toContainText("2번째 음표");

  // Esc: 다시 열고 닫기
  await tap(1);
  await expect(toolbar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toolbar).toHaveCount(0);
});

test("드래그: 선택한 음표를 위로 끌면 반음 단위로 올라감", async ({ page, isMobile }) => {
  test.skip(isMobile, "마우스 드래그는 desktop 프로젝트에서 검증");
  await createScoreViaKeys(page);
  await enterEditMode(page);
  const live = page.getByTestId("cursor-live");
  const handle = page.getByTestId("score-handle");

  await expect(async () => {
    const c = await noteCenter(page, 1);
    await page.mouse.click(c.x, c.y);
    await expect(live).toContainText("2번째 음표", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(handle).toBeVisible();
  const before = (await live.textContent())!; // 예: 2번째 음표 · D4 · 4분음표
  const m = /· ([A-G]#?)(\d) ·/.exec(before)!;

  await handle.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const scale = await page.locator(".score-sheet:visible svg").first().evaluate((svg) => {
    const image = svg as SVGSVGElement;
    return image.getBoundingClientRect().width / image.viewBox.baseVal.width;
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 12 * scale, { steps: 4 });
  await page.mouse.move(x, y - 21 * scale, { steps: 4 });
  await expect(page.getByTestId("score-drag-label")).toBeVisible();
  await page.mouse.up();

  await expect(live).not.toHaveText(before);
  // D4 → E4 (+2 반음)
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const idx = names.indexOf(m[1]) + 2;
  const expected = `${names[idx % 12]}${Number(m[2]) + Math.floor(idx / 12)}`;
  await expect(live).toContainText(expected);
});

test("제목·작곡자: 악보에 그려지고 Enter/Esc 로 편집", async ({ page }) => {
  await createScoreViaKeys(page);
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });

  const title = page.getByLabel("악보 제목");
  await title.fill("나의 노래");
  await title.press("Enter");
  await expect(page.getByText("제목을 저장했어요")).toBeVisible();
  await expect(page.getByTestId("score-header").getByRole("heading", { name: "나의 노래" })).toBeVisible({ timeout: 15_000 });

  const composer = page.getByLabel("작곡자", { exact: true });
  await composer.fill("홍길동");
  await composer.press("Enter");
  await expect(page.getByTestId("score-header-credits").filter({ hasText: "홍길동" })).toBeVisible({ timeout: 15_000 });

  // Esc 는 되돌림
  await title.fill("취소될 제목");
  await title.press("Escape");
  await expect(title).toHaveValue("나의 노래");

  // 새로고침 후 유지
  await page.getByRole("group", { name: "악보 편집 적용과 저장" }).getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await expect(page.getByLabel("작곡자", { exact: true })).toHaveValue("홍길동");
});

test("TitleDialog: 작곡자 입력이 악보에 저장되고 대화상자가 남지 않음", async ({ page }) => {
  await openKeysInput(page);
  for (const k of ["a", "s"]) await holdNote(page, k);
  await expect(page.getByText("2개 음표")).toBeVisible();
  await page.getByRole("button", { name: "악보로 저장" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("제목").fill("합작곡");
  await dlg.getByLabel("작곡 (선택)").fill("김작곡");
  await dlg.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForURL(/\/scores\/[^/]+$/);
  await page.getByRole("button", { name: "편집모드", exact: true }).click();
  await expect(page.getByLabel("작곡자", { exact: true })).toHaveValue("김작곡");
  await expect(page.getByRole("dialog")).toHaveCount(0); // (숨겨진 이전 화면의 노드는 제외)
});
