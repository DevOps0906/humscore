import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * 로그인 e2e.
 * - 기본 빌드는 체험(mock) 로그인(NEXT_PUBLIC_AUTH_MOCK≠"0"): /login 은 "체험 로그인으로 시작" 카드만 보인다.
 * - 실제 이메일 OTP·Google 폼은 mock 이 꺼진 빌드에서만 존재 → NEXT_PUBLIC_AUTH_MOCK=0 또는 E2E_SUPABASE=1 일 때만 실행.
 *   (테스트 프로세스의 환경변수로 판단하므로, 대상 서버도 같은 값으로 빌드돼 있어야 한다)
 */
const realAuth = process.env.NEXT_PUBLIC_AUTH_MOCK === "0" || process.env.E2E_SUPABASE === "1";
const SIGNED_OUT_KEY = "humscore.authMock.signedOut";

test.describe("체험(mock) 로그인", () => {
  test.skip(realAuth, "NEXT_PUBLIC_AUTH_MOCK=0 / E2E_SUPABASE=1 — 실제 로그인 빌드에서는 체험 로그인이 없음");

  /** 이 기기의 mock 세션을 끈 상태로 만든다 (기본은 로그인 상태) */
  async function signOutMock(page: Page) {
    await page.goto("/library");
    await page.evaluate((k) => localStorage.setItem(k, "1"), SIGNED_OUT_KEY);
  }

  test("/login 은 체험 카드만 — 이메일·Google 폼 없음, 시작하면 /library 에 배지", async ({ page }) => {
    await signOutMock(page);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();
    const start = page.getByRole("button", { name: "체험 로그인으로 시작" });
    await expect(start).toBeVisible();
    await expect(page.getByLabel("이메일 주소")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Google로 계속하기" })).toHaveCount(0);

    await start.click();
    await page.waitForURL(/\/library$/);
    await expect(page.getByText("체험 로그인", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  });

  test("?next 경로로 이동, 외부 경로(//)는 /library 로 대체", async ({ page }) => {
    await signOutMock(page);
    await page.goto("/login?next=/keys");
    await page.getByRole("button", { name: "체험 로그인으로 시작" }).click();
    await page.waitForURL(/\/keys$/);

    await page.evaluate((k) => localStorage.setItem(k, "1"), SIGNED_OUT_KEY);
    await page.goto("/login?next=//evil.example");
    await page.getByRole("button", { name: "체험 로그인으로 시작" }).click();
    await page.waitForURL(/\/library$/);
  });

  test("로그아웃 → 비회원 배너 → 배너의 로그인 → 재로그인", async ({ page }) => {
    await page.goto("/library");
    const badge = page.getByText("체험 로그인", { exact: true });
    await expect(badge).toBeVisible();
    const banner = page.getByRole("note").filter({ hasText: "이 기기에 저장됨 · 로그인하면 동기화" });
    await expect(banner).toHaveCount(0);

    await page.getByRole("button", { name: "로그아웃" }).click();
    await expect(badge).toHaveCount(0);
    await expect(banner).toBeVisible();

    await banner.getByRole("link", { name: "로그인" }).click();
    await page.waitForURL(/\/login/);
    await page.getByRole("button", { name: "체험 로그인으로 시작" }).click();
    await page.waitForURL(/\/library$/);
    await expect(badge).toBeVisible();
    await expect(banner).toHaveCount(0);
  });
});

test.describe("실제 로그인 (Supabase)", () => {
  test.skip(!realAuth, "체험(mock) 로그인 기본 빌드 — 실제 OTP·Google 폼은 NEXT_PUBLIC_AUTH_MOCK=0 또는 E2E_SUPABASE=1 일 때만 검사");

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
});
