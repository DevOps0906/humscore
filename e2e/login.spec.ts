import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** 로그인 폼이 활성인지(= Supabase 환경변수 있음) 확인. 아니면 테스트를 건너뜀 */
async function openLogin(page: Page) {
  await page.goto("/login");
  const email = page.getByLabel("이메일 주소");
  const enabled = await email.isVisible({ timeout: 5000 }).catch(() => false);
  test.skip(!enabled, "Supabase 환경변수 없음 (로그인 비활성)");
  return email;
}

test("로그인: 이메일 입력 + Google 버튼 렌더링", async ({ page }) => {
  const email = await openLogin(page);
  await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
  await expect(email).toBeVisible();
  await expect(page.getByRole("button", { name: "Google로 계속하기" })).toBeVisible();
});

test("로그인: 잘못된 이메일은 같은 단계에 머묾", async ({ page }) => {
  const email = await openLogin(page);
  let otpCalls = 0;
  await page.route("**/auth/v1/otp**", (r) => {
    otpCalls++;
    return r.fulfill({ status: 200, body: "{}" });
  });
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await expect(email).toBeVisible();
  await expect(page.getByLabel("인증 코드 6자리")).toHaveCount(0);
  expect(otpCalls).toBe(0);
  expect(await email.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
});

test("로그인: OTP 단계 UI (네트워크 모킹)", async ({ page }) => {
  const email = await openLogin(page);
  await page.route("**/auth/v1/otp**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await email.fill("tester@example.com");
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();

  const otp = page.getByLabel("인증 코드 6자리");
  await expect(otp).toBeVisible();
  await expect(page.getByText(/tester@example\.com 로 메일을 보냈어요/)).toBeVisible();
  const submit = page.getByRole("button", { name: "코드로 로그인" });
  await expect(submit).toBeDisabled();
  await otp.fill("123456");
  await expect(submit).toBeEnabled();

  await page.getByRole("button", { name: "이메일 다시 입력" }).click();
  await expect(page.getByLabel("이메일 주소")).toBeVisible();
});
