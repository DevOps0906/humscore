import { defineConfig, devices } from "@playwright/test";

/**
 * E2E: 기본은 로컬 프로덕션 빌드(next start, 3101 포트)를 대상으로 실행.
 * 배포본 대상: E2E_BASE_URL=https://humscore.vercel.app npm run test:e2e
 * 마이크는 Chromium 가짜 장치로 대체 (실제 음성 데이터 없음).
 */
const PORT = 3101;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const fakeMedia = {
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "on-first-retry", locale: "ko-KR" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...fakeMedia } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...fakeMedia } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
