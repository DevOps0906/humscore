import { expect, test } from "./fixtures";
import { createScoreViaKeys } from "./fixtures";

/**
 * 실제 로컬 Supabase 로그인 + 동기화 e2e. E2E_SUPABASE=1 일 때만 실행.
 * 앱 빌드에 로컬 env 가 들어가야 한다(playwright 가 `npm run build` 를 상속 환경변수로 실행):
 *   npm run db:start
 *   E2E_SUPABASE=1 NEXT_PUBLIC_AUTH_MOCK=0 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon> \
 *     npx playwright test e2e/cloud-sync.spec.ts --project=desktop
 * 주의: 로컬 Auth 는 메일 발송 2회/시간(config.toml) — 한 번 실행에 2회 사용하므로 한 시간에 1회만 가능.
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

async function readMagicLink(email: string, notBefore: number): Promise<string> {
  let link = "";
  await expect(async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const msgs = (list.messages ?? []) as { ID: string; Created: string }[];
    const fresh = msgs.filter((m) => Date.parse(m.Created) >= notBefore - 2000).sort((x, y) => Date.parse(y.Created) - Date.parse(x.Created));
    expect(fresh.length).toBeGreaterThan(0);
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${fresh[0].ID}`)).json();
    const m = /(http:\/\/(?:127\.0\.0\.1|localhost):55321\/auth\/v1\/verify\?[^\s)"<]+)/.exec(String(msg.Text ?? ""));
    expect(m).not.toBeNull();
    link = m![1];
  }).toPass({ timeout: 20_000 });
  return link;
}

// 로컬 Auth 기본 메일 템플릿에는 6자리 코드가 없고 매직링크만 있다 → 같은 브라우저 컨텍스트에서 링크를 연다(PKCE).
async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("이메일 주소").fill(email);
  const sentAt = Date.now();
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await expect(page.getByLabel("인증 코드 6자리")).toBeVisible();
  await page.goto(await readMagicLink(email, sentAt));
  await page.goto("/library");
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible({ timeout: 15_000 });
}

test("이메일 로그인 → 악보 저장 → 새 브라우저 컨텍스트 로그인 → 동기화된 악보 확인", async ({ page, browser, baseURL }) => {
  const email = `e2e-${Date.now()}@example.test`;
  await login(page, email);
  const id = await createScoreViaKeys(page);
  await page.goto("/library");
  await expect(page.locator(`a[href="/scores/${id}"]`)).toBeVisible();
  await expect(page.getByText("동기화 중…")).toHaveCount(0, { timeout: 15_000 });

  const ctx = await browser.newContext({ baseURL, locale: "ko-KR" });
  try {
    const page2 = await ctx.newPage();
    await login(page2, email);
    await page2.goto("/library");
    await expect(page2.locator(`a[href="/scores/${id}"]`)).toBeVisible({ timeout: 20_000 });
  } finally {
    await ctx.close();
  }
});
