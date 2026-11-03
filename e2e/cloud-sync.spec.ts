import { expect, test } from "./fixtures";
import { createScoreViaKeys } from "./fixtures";

/**
 * 실제 로컬 Supabase 로그인 + 동기화 e2e. E2E_SUPABASE=1 일 때만 실행.
 * 앱 빌드에 로컬 env 가 들어가야 한다(playwright 가 `npm run build` 를 상속 환경변수로 실행):
 *   npm run db:start
 *   E2E_SUPABASE=1 NEXT_PUBLIC_AUTH_MOCK=0 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon> \
 *     npx playwright test e2e/cloud-sync.spec.ts --project=desktop
 * 로컬 Auth 메일 템플릿(supabase/templates)에 "<strong>{{ .Token }}</strong>" 6자리 코드가 있다 — 첫 로그인은 코드 입력, 둘째는 매직링크(/auth/callback 커버리지).
 * 메일 발송 한도 30회/시간(config.toml) — 한 번 실행에 2회 사용.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const enabled = process.env.E2E_SUPABASE === "1";

if (enabled && !/^http:\/\/(127\.0\.0\.1|localhost):55321\/?$/.test(supaUrl)) {
  throw new Error(`E2E_SUPABASE 는 로컬 Supabase(:55321)에서만 실행됩니다: ${supaUrl || "(URL 없음)"}`);
}

test.describe.configure({ mode: "serial" });
test.skip(!enabled, "E2E_SUPABASE=1 일 때만 실행");
test.skip(process.env.NEXT_PUBLIC_AUTH_MOCK !== "0", "체험(mock) 로그인 빌드 — NEXT_PUBLIC_AUTH_MOCK=0 으로 빌드한 서버에서만 실행");
test.skip(({ isMobile }) => isMobile, "desktop 프로젝트만");

type LoginMail = { subject: string; code: string; link: string };

/** 템플릿(supabase/templates/*.html)의 <strong> 안 6자리(Text 판은 6자리만 있는 줄)만 읽는다 — 본문의 다른 숫자(링크 토큰 등)를 잡지 않도록 */
function extractCode(text: string, html: string): string | null {
  return /<strong>\s*(\d{6})\s*<\/strong>/.exec(html)?.[1] ?? /^\s*(\d{6})\s*$/m.exec(text)?.[1] ?? null;
}

async function readLoginMail(email: string, notBefore: number): Promise<LoginMail> {
  let mail: LoginMail = { subject: "", code: "", link: "" };
  await expect(async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const msgs = (list.messages ?? []) as { ID: string; Created: string }[];
    const fresh = msgs.filter((m) => Date.parse(m.Created) >= notBefore - 2000).sort((x, y) => Date.parse(y.Created) - Date.parse(x.Created));
    expect(fresh.length).toBeGreaterThan(0);
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json();
    const text = String(msg.Text ?? "");
    const html = String(msg.HTML ?? "");
    const code = extractCode(text, html);
    expect(code, `메일 본문에 6자리 코드가 없음 — 제목: ${msg.Subject}`).not.toBeNull();
    const m = /(http:\/\/(?:127\.0\.0\.1|localhost):55321\/auth\/v1\/verify\?[^\s)"<]+)/.exec(text) ?? /(http:\/\/(?:127\.0\.0\.1|localhost):55321\/auth\/v1\/verify\?[^\s)"<]+)/.exec(html);
    expect(m).not.toBeNull();
    mail = { subject: String(msg.Subject ?? ""), code: code!, link: m![1].replace(/&amp;/g, "&") };
  }).toPass({ timeout: 20_000 });
  console.log(`[cloud-sync] 받은 메일 제목: ${mail.subject}`);
  return mail;
}

async function requestMail(page: import("@playwright/test").Page, email: string): Promise<LoginMail> {
  await page.goto("/login");
  await page.getByLabel("이메일 주소").fill(email);
  const sentAt = Date.now();
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await expect(page.getByLabel("인증 코드 6자리")).toBeVisible();
  return readLoginMail(email, sentAt);
}

async function expectSignedIn(page: import("@playwright/test").Page) {
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible({ timeout: 15_000 });
}

/** 6자리 코드 입력 로그인. 먼저 틀린 코드로 실패 경로(오류 문구)를 확인한 뒤 맞는 코드를 넣는다 — 추가 메일 발송 없음 */
async function loginWithOtp(page: import("@playwright/test").Page, email: string): Promise<string> {
  const mail = await requestMail(page, email);
  // 새 이메일은 가입 확인 템플릿, 기존 사용자는 로그인 템플릿 (config.toml)
  expect(mail.subject).toMatch(/^HumScore .*코드$/);
  const otp = page.getByLabel("인증 코드 6자리");
  const submit = page.getByRole("button", { name: "코드로 로그인" });
  const wrong = mail.code.replace(/^\d/, (d) => String((Number(d) + 1) % 10));
  await otp.fill(wrong);
  await submit.click();
  await expect(page.getByText("코드가 맞지 않거나 만료됐어요.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // input-otp는 꽉 찬 값 위에 fill 하면 바꾸지 않는다 → 먼저 비운다
  await otp.clear();
  await otp.fill(mail.code);
  await expect(otp).toHaveValue(mail.code);
  await submit.click();
  await page.waitForURL(/\/library$/, { timeout: 15_000 });
  await expectSignedIn(page);
  return mail.subject;
}

/** 기존 매직링크 경로(/auth/v1/verify → /auth/callback). 같은 브라우저 컨텍스트에서 링크를 연다(PKCE) */
async function loginWithMagicLink(page: import("@playwright/test").Page, email: string): Promise<string> {
  const mail = await requestMail(page, email);
  await page.goto(mail.link);
  await expectSignedIn(page);
  return mail.subject;
}

test("OTP 코드 로그인 → 악보 저장 → 새 브라우저 컨텍스트 매직링크 로그인 → 동기화된 악보 확인", async ({ page, browser, baseURL }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await loginWithOtp(page, email);
  const id = await createScoreViaKeys(page);
  await page.goto("/library");
  await expect(page.locator(`a[href="/scores/${id}"]`).first()).toBeVisible();
  await expect(page.getByText("동기화 중…")).toHaveCount(0, { timeout: 15_000 });

  const ctx = await browser.newContext({ baseURL, locale: "ko-KR" });
  try {
    const page2 = await ctx.newPage();
    await loginWithMagicLink(page2, email);
    await page2.goto("/library");
    await expect(page2.locator(`a[href="/scores/${id}"]`).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await ctx.close();
  }
});

test("메일 코드 추출: <strong> 안 6자리만, HTML 없으면 Text의 6자리 줄", () => {
  const html = '<p><a href="http://127.0.0.1:55321/auth/v1/verify?token=1234567890">로그인하기</a></p><p style="font-size:24px;"><strong>482913</strong></p>';
  expect(extractCode("", html)).toBe("482913");
  expect(extractCode("링크 123456x\n105522\n", "")).toBe("105522");
  expect(extractCode("주문번호 123456 · 링크 http://x/verify?token=654321", "<p>654321</p>")).toBeNull();
  expect(extractCode("1234567", "<strong>1234567</strong>")).toBeNull();
});
