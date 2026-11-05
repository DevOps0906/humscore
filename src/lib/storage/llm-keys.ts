/**
 * LLM API 키 보관. 키는 이 기기의 localStorage 에만 두고 HumScore 서버·클라우드 동기화로 보내지 않는다.
 * 악보·음표 데이터(Score)와 섞이지 않도록 별도 키를 쓴다. 순수 검증 함수는 브라우저 의존이 없다.
 */

export type LlmProviderId = "openai" | "claude" | "gemini";

export interface LlmProviderInfo {
  id: LlmProviderId;
  label: string;
  /** 입력 칸 안내 예시(실제 키가 아님) */
  placeholder: string;
  /** 키 형식 검사. 형식만 보고 실제 유효성은 제공사가 판단한다 */
  pattern: RegExp;
  formatHint: string;
  defaultModel: string;
  keyPageUrl: string;
}

export const LLM_PROVIDERS: readonly LlmProviderInfo[] = [
  { id: "openai", label: "OpenAI API", placeholder: "sk-...", pattern: /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/, formatHint: "sk- 로 시작하는 키", defaultModel: "gpt-4o-mini", keyPageUrl: "https://platform.openai.com/api-keys" },
  { id: "claude", label: "Claude API", placeholder: "sk-ant-...", pattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/, formatHint: "sk-ant- 로 시작하는 키", defaultModel: "claude-3-5-haiku-latest", keyPageUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", label: "Gemini API", placeholder: "AIza...", pattern: /^AIza[A-Za-z0-9_-]{30,}$/, formatHint: "AIza 로 시작하는 키", defaultModel: "gemini-1.5-flash", keyPageUrl: "https://aistudio.google.com/apikey" },
];

export interface LlmProviderConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export type LlmConfigs = Record<LlmProviderId, LlmProviderConfig>;

export const LLM_STORAGE_KEY = "humscore.llm.v1";
export const MODEL_MAX_LENGTH = 80;

export function providerInfo(id: LlmProviderId): LlmProviderInfo {
  return LLM_PROVIDERS.find((provider) => provider.id === id)!;
}

export function emptyConfigs(): LlmConfigs {
  return Object.fromEntries(LLM_PROVIDERS.map((provider) => [provider.id, { apiKey: "", model: provider.defaultModel, enabled: false }])) as LlmConfigs;
}

/** 앞뒤 공백·줄바꿈을 지운 키가 제공사 형식에 맞는지 */
export function validateApiKey(id: LlmProviderId, raw: string): { ok: true; key: string } | { ok: false; reason: string } {
  const key = raw.trim();
  if (!key) return { ok: false, reason: "API 키를 입력해 주세요." };
  if (/\s/.test(key)) return { ok: false, reason: "키에 공백이 들어 있어요. 복사한 키를 그대로 붙여 넣어 주세요." };
  const info = providerInfo(id);
  if (!info.pattern.test(key)) return { ok: false, reason: `${info.label} 키 형식이 아니에요. (${info.formatHint})` };
  return { ok: true, key };
}

/** 화면에는 끝 4자리만 보여 준다. 짧은 값은 전부 가린다. */
export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, key.startsWith("sk-ant-") ? 7 : key.startsWith("sk-") ? 3 : 4)}••••••••${key.slice(-4)}`;
}

const clampModel = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim().slice(0, MODEL_MAX_LENGTH) : fallback;

/** 저장된 JSON 을 안전하게 읽는다. 깨진 값·알 수 없는 제공사는 무시한다. */
export function parseConfigs(raw: string | null): LlmConfigs {
  const configs = emptyConfigs();
  if (!raw) return configs;
  try {
    const data = JSON.parse(raw) as Record<string, Partial<LlmProviderConfig> | undefined>;
    for (const provider of LLM_PROVIDERS) {
      const entry = data?.[provider.id];
      if (!entry || typeof entry !== "object") continue;
      const apiKey = typeof entry.apiKey === "string" && provider.pattern.test(entry.apiKey) ? entry.apiKey : "";
      configs[provider.id] = { apiKey, model: clampModel(entry.model, provider.defaultModel), enabled: apiKey ? entry.enabled === true : false };
    }
  } catch {
    /* 깨진 저장값은 비운 상태로 */
  }
  return configs;
}

export function loadLlmConfigs(): LlmConfigs {
  try {
    return parseConfigs(localStorage.getItem(LLM_STORAGE_KEY));
  } catch {
    return emptyConfigs();
  }
}

/** 한 제공사 설정을 갱신하고 전체를 저장해 돌려준다. 키가 없으면 사용 중 상태도 해제한다. */
export function saveLlmConfig(id: LlmProviderId, patch: Partial<LlmProviderConfig>): LlmConfigs {
  const configs = loadLlmConfigs();
  const info = providerInfo(id);
  const next = { ...configs[id], ...patch };
  next.model = clampModel(next.model, info.defaultModel);
  if (!next.apiKey) next.enabled = false;
  configs[id] = next;
  try {
    localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(configs));
  } catch {
    /* 저장소 접근 불가 — 이번 화면에서만 유지 */
  }
  return configs;
}

export function clearLlmConfig(id: LlmProviderId): LlmConfigs {
  return saveLlmConfig(id, { apiKey: "", enabled: false, model: providerInfo(id).defaultModel });
}
