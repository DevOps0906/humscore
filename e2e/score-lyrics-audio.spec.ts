import { createScoreViaKeys, expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** 음 여러 개를 이어 붙인 16bit 모노 WAV (합성 사인파, 실제 녹음 아님) */
function sineWav(freqs: number[], noteSec = 0.6, gapSec = 0.08, sr = 22050): Buffer {
  const per = Math.round(sr * (noteSec + gapSec));
  const on = Math.round(sr * noteSec);
  const n = per * freqs.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  freqs.forEach((f, k) => {
    for (let i = 0; i < on; i++) {
      const v = 0.4 * Math.sin((2 * Math.PI * f * i) / sr);
      buf.writeInt16LE(Math.round(v * 32767), 44 + (k * per + i) * 2);
    }
  });
  return buf;
}

async function noOverflow(page: Page) {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `가로 넘침 @${width}`).toBeLessThanOrEqual(0);
  }
}

test("가사 등록: 직접 입력 → 적용하면 악보에 가사 표시, 지우기", async ({ page }) => {
  // 헤드리스 Chromium 은 SpeechRecognition.available() 호출 시 렌더러가 죽음 → 미지원 기기로 가정
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await createScoreViaKeys(page);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "가사 등록" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/이 기기에서는 음성 가사 입력을 지원하지 않아요/)).toBeVisible();
  await noOverflow(page);
  await dialog.getByRole("textbox").fill("가나다라");
  await expect(dialog.getByText(/4음절 \/ 붙일 수 있는 음표 3개 · 1음절이 남아요/)).toBeVisible();
  await dialog.getByRole("button", { name: "적용" }).click();
  await expect(page.getByText(/1음절이 남았어요: 라/)).toBeVisible();
  const sheet = page.locator(".score-sheet svg").first();
  for (const t of ["가", "나", "다"]) await expect(sheet.locator("text", { hasText: t }).first()).toBeAttached();

  await page.getByRole("button", { name: "가사 등록" }).click();
  await expect(dialog.getByRole("textbox")).toHaveValue("가 나 다");
  await dialog.getByRole("button", { name: "가사 지우기" }).click();
  await expect(sheet.locator("text", { hasText: "가" })).toHaveCount(0);
});

test("음원 등록: 합성 WAV 업로드 → 음표 교체", async ({ page }) => {
  await createScoreViaKeys(page);
  await expect(page.locator(".score-sheet svg").first()).toBeVisible({ timeout: 15_000 });
  const heads = page.locator(".score-sheet .vf-notehead");
  const before = await heads.count();
  await page.getByRole("button", { name: "음원 등록" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("tab", { name: /파일/ })).toBeVisible();
  await expect(dialog.getByRole("tab", { name: /마이크/ })).toBeVisible();
  await noOverflow(page);
  // C4 E4 G4 C5 E5
  await dialog.getByLabel("음원 파일").setInputFiles({
    name: "sine.wav",
    mimeType: "audio/wav",
    buffer: sineWav([261.63, 329.63, 392, 523.25, 659.25]),
  });
  await expect(dialog.getByText(/음표 \d+개를 찾았어요/)).toBeVisible({ timeout: 20_000 });
  await noOverflow(page);
  await dialog.getByRole("button", { name: "적용" }).click();
  await expect(page.getByText("음표를 새로 바꿨어요")).toBeVisible();
  await expect.poll(async () => heads.count(), { timeout: 10_000 }).toBeGreaterThan(before);
});
