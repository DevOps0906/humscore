import { expect, test } from "./fixtures";

const OPENAI = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";
const CLAUDE = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
const GEMINI = "AIzaSyA-abcdefghijklmnopqrstuvwxyz012345";

test("설정의 항목은 탭으로 나뉘고 해시로 바로 열린다", async ({ page }) => {
  await page.goto("/settings#llm");
  const tabs = page.getByRole("tablist", { name: "설정 항목" });
  await expect(tabs.getByRole("tab", { name: "LLM API", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "LLM API" })).toBeVisible();
  await tabs.getByRole("tab", { name: "기본값", exact: true }).click();
  await expect(page).toHaveURL(/#defaults$/);
  await page.reload();
  await expect(tabs.getByRole("tab", { name: "기본값", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("LLM API: OpenAI·Claude·Gemini 3개 카드가 있고 키는 마스킹되어 이 기기에만 저장된다", async ({ page }) => {
  await page.goto("/settings#llm");
  for (const name of ["OpenAI API", "Claude API", "Gemini API"]) await expect(page.getByRole("article", { name })).toBeVisible();
  await expect(page.getByTestId("llm-privacy-note")).toContainText("이 기기의 브라우저 저장소에만");

  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  const openai = page.getByRole("article", { name: "OpenAI API" });
  const input = openai.getByLabel("OpenAI API 키");
  await expect(input).toHaveAttribute("type", "password");
  await input.fill("sk-short");
  await openai.getByRole("button", { name: "키 저장" }).click();
  await expect(openai.getByRole("alert")).toContainText("형식이 아니에요");
  await input.fill(CLAUDE); // 다른 제공사의 키는 거부
  await openai.getByRole("button", { name: "키 저장" }).click();
  await expect(openai.getByRole("alert")).toBeVisible();

  await input.fill(OPENAI);
  await openai.getByRole("button", { name: "키 저장" }).click();
  await expect(openai.getByTestId("llm-openai-status")).toHaveText("사용 중");
  await expect(openai.getByTestId("llm-openai-masked")).toContainText("sk-••••••••6789");
  await expect(openai.getByTestId("llm-openai-masked")).not.toContainText("abcdefghij");
  // 입력 칸은 비워지고, 키는 localStorage 에만 있다
  await expect(openai.getByLabel("OpenAI API 키")).toHaveValue("");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("humscore.llm.v1") ?? "null"));
  expect(stored.openai).toMatchObject({ apiKey: OPENAI, enabled: true, model: "gpt-4o-mini" });
  expect(stored.claude.apiKey).toBe("");
  // 서버로 키를 보내는 요청은 없다
  expect(requests.filter((url) => url.includes("sk-proj") || url.includes("api/llm"))).toEqual([]);

  const claude = page.getByRole("article", { name: "Claude API" });
  await claude.getByLabel("Claude API 키").fill(CLAUDE);
  await claude.getByLabel("Claude API 모델").fill("claude-sonnet");
  await claude.getByRole("button", { name: "키 저장" }).click();
  await expect(claude.getByTestId("llm-claude-status")).toHaveText("사용 중");

  const gemini = page.getByRole("article", { name: "Gemini API" });
  await gemini.getByLabel("Gemini API 키").fill(GEMINI);
  await gemini.getByRole("button", { name: "키 저장" }).click();
  await expect(gemini.getByTestId("llm-gemini-masked")).toContainText("2345");

  // 사용 해제 → 새로고침 후에도 유지
  await gemini.getByRole("checkbox", { name: "Gemini API 사용" }).uncheck();
  await expect(gemini.getByTestId("llm-gemini-status")).toHaveText("저장됨 · 사용 안 함");
  await page.reload();
  await expect(page.getByRole("article", { name: "OpenAI API" }).getByTestId("llm-openai-masked")).toContainText("6789");
  await expect(page.getByRole("article", { name: "Claude API" }).getByLabel("Claude API 모델")).toHaveValue("claude-sonnet");
  await expect(page.getByRole("article", { name: "Gemini API" }).getByTestId("llm-gemini-status")).toHaveText("저장됨 · 사용 안 함");
});

test("LLM API: 키를 지우면 기본 상태로 돌아가고, 눈 아이콘 없이도 보기/숨기기를 쓸 수 있다", async ({ page }) => {
  await page.goto("/settings#llm");
  const claude = page.getByRole("article", { name: "Claude API" });
  const input = claude.getByLabel("Claude API 키");
  await input.fill(CLAUDE);
  await claude.getByRole("button", { name: "보기" }).click();
  await expect(input).toHaveAttribute("type", "text");
  await claude.getByRole("button", { name: "숨기기" }).click();
  await expect(input).toHaveAttribute("type", "password");
  await claude.getByRole("button", { name: "키 저장" }).click();
  await expect(claude.getByTestId("llm-claude-status")).toHaveText("사용 중");
  await claude.getByRole("button", { name: "키 삭제" }).click();
  await expect(claude.getByTestId("llm-claude-status")).toHaveText("키 없음");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("humscore.llm.v1") ?? "null"));
  expect(stored.claude).toEqual({ apiKey: "", model: "claude-3-5-haiku-latest", enabled: false });
});
