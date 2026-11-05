import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLM_STORAGE_KEY, clearLlmConfig, emptyConfigs, loadLlmConfigs, maskApiKey, parseConfigs, saveLlmConfig, validateApiKey } from "./llm-keys";

const OPENAI = "sk-proj-abcdefghijklmnopqrstuvwxyz0123456789";
const CLAUDE = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
const GEMINI = "AIzaSyA-abcdefghijklmnopqrstuvwxyz012345";

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("API 키 형식 검사", () => {
  it("제공사별 형식을 받아들이고 앞뒤 공백은 지운다", () => {
    expect(validateApiKey("openai", `  ${OPENAI}\n`)).toEqual({ ok: true, key: OPENAI });
    expect(validateApiKey("claude", CLAUDE).ok).toBe(true);
    expect(validateApiKey("gemini", GEMINI).ok).toBe(true);
  });
  it("다른 제공사 키·빈 값·공백 포함·너무 짧은 값은 거부한다", () => {
    expect(validateApiKey("openai", CLAUDE).ok).toBe(false); // Claude 키는 OpenAI 칸에 들어가지 않는다
    expect(validateApiKey("claude", OPENAI).ok).toBe(false);
    expect(validateApiKey("gemini", OPENAI).ok).toBe(false);
    expect(validateApiKey("openai", "").ok).toBe(false);
    expect(validateApiKey("openai", "sk-abc def ghijklmnopqrstuvwxyz").ok).toBe(false);
    expect(validateApiKey("openai", "sk-short").ok).toBe(false);
  });
});

describe("키 마스킹", () => {
  it("끝 4자리만 보인다", () => {
    expect(maskApiKey(OPENAI)).toBe("sk-••••••••6789");
    expect(maskApiKey(CLAUDE)).toBe("sk-ant-••••••••6789");
    expect(maskApiKey(GEMINI).endsWith("2345")).toBe(true);
    expect(maskApiKey(OPENAI)).not.toContain("abcdefghij");
  });
  it("짧은 값은 모두 가리고 빈 값은 빈 문자열", () => {
    expect(maskApiKey("abc")).toBe("•••");
    expect(maskApiKey("")).toBe("");
  });
});

describe("저장·복원", () => {
  it("기본값은 비어 있고 제공사별 기본 모델이 들어 있다", () => {
    const configs = loadLlmConfigs();
    expect(configs).toEqual(emptyConfigs());
    expect(configs.openai.model).toBe("gpt-4o-mini");
    expect(Object.values(configs).every((c) => !c.apiKey && !c.enabled)).toBe(true);
  });
  it("저장하면 다시 읽을 때 복원되고 다른 제공사는 그대로다", () => {
    saveLlmConfig("claude", { apiKey: CLAUDE, enabled: true, model: "  claude-sonnet  " });
    const configs = loadLlmConfigs();
    expect(configs.claude).toEqual({ apiKey: CLAUDE, model: "claude-sonnet", enabled: true });
    expect(configs.openai.apiKey).toBe("");
  });
  it("키가 없으면 사용 중으로 둘 수 없다", () => {
    expect(saveLlmConfig("gemini", { enabled: true }).gemini.enabled).toBe(false);
  });
  it("삭제하면 키·사용 여부·모델이 기본값으로 돌아간다", () => {
    saveLlmConfig("openai", { apiKey: OPENAI, enabled: true, model: "x" });
    const configs = clearLlmConfig("openai");
    expect(configs.openai).toEqual({ apiKey: "", model: "gpt-4o-mini", enabled: false });
  });
  it("깨진 저장값·형식이 다른 키·알 수 없는 제공사는 무시한다", () => {
    expect(parseConfigs("not json")).toEqual(emptyConfigs());
    const configs = parseConfigs(JSON.stringify({ openai: { apiKey: "bad", enabled: true }, claude: { apiKey: CLAUDE, enabled: true, model: 5 }, other: { apiKey: OPENAI } }));
    expect(configs.openai).toEqual({ apiKey: "", model: "gpt-4o-mini", enabled: false });
    expect(configs.claude).toEqual({ apiKey: CLAUDE, model: "claude-3-5-haiku-latest", enabled: true });
  });
  it("저장 키 이름은 악보 저장소와 겹치지 않는다", () => {
    saveLlmConfig("openai", { apiKey: OPENAI });
    expect([...store.keys()]).toEqual([LLM_STORAGE_KEY]);
    expect(LLM_STORAGE_KEY).not.toContain("scores");
  });
});
