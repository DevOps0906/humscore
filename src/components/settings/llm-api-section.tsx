"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LLM_PROVIDERS, MODEL_MAX_LENGTH, clearLlmConfig, emptyConfigs, loadLlmConfigs, maskApiKey, saveLlmConfig, validateApiKey,
  type LlmConfigs, type LlmProviderInfo,
} from "@/lib/storage/llm-keys";
import { SettingsSection } from "./settings-section";

function ProviderCard({ provider, config, onChange }: {
  provider: LlmProviderInfo;
  config: LlmConfigs[LlmProviderInfo["id"]];
  onChange: (configs: LlmConfigs) => void;
}) {
  const [draftKey, setDraftKey] = useState("");
  const [model, setModel] = useState(config.model);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = config.apiKey !== "";
  const idBase = `llm-${provider.id}`;

  function save() {
    // 새 키를 입력했으면 형식을 확인하고, 비워 두면 모델만 바꾼다
    if (draftKey.trim()) {
      const result = validateApiKey(provider.id, draftKey);
      if (!result.ok) { setError(result.reason); return; }
      onChange(saveLlmConfig(provider.id, { apiKey: result.key, model, enabled: true }));
      setDraftKey("");
      setReveal(false);
      toast.success(`${provider.label} 키를 이 기기에 저장했어요`);
    } else if (saved) {
      onChange(saveLlmConfig(provider.id, { model }));
      toast.success(`${provider.label} 모델을 저장했어요`);
    } else {
      setError("API 키를 입력해 주세요.");
      return;
    }
    setError(null);
  }

  return (
    <article aria-label={provider.label} className="grid gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium">{provider.label}</h3>
        <span
          data-testid={`${idBase}-status`}
          className={`rounded-full px-3 py-1 text-xs ${saved ? (config.enabled ? "bg-accent/15 text-accent" : "bg-section text-ink-soft") : "bg-section text-ink-soft"}`}
        >
          {saved ? (config.enabled ? "사용 중" : "저장됨 · 사용 안 함") : "키 없음"}
        </span>
      </div>
      {saved && <p className="text-sm text-ink-soft" data-testid={`${idBase}-masked`}>저장된 키: <span className="tabular-nums">{maskApiKey(config.apiKey)}</span></p>}
      <label className="grid gap-1.5 text-sm" htmlFor={`${idBase}-key`}>
        <span className="text-ink-soft">{saved ? "새 키로 바꾸기" : "API 키"}</span>
        <div className="flex gap-2">
          <Input
            id={`${idBase}-key`}
            aria-label={`${provider.label} 키`}
            aria-invalid={error ? true : undefined}
            type={reveal ? "text" : "password"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={draftKey}
            onChange={(event) => { setDraftKey(event.target.value); setError(null); }}
            placeholder={provider.placeholder}
            className="h-11 min-w-0 flex-1 text-base lg:h-9 lg:text-sm"
          />
          <Button type="button" variant="outline" aria-pressed={reveal} onClick={() => setReveal((value) => !value)} className="h-11 shrink-0 rounded-full px-4 text-sm lg:h-9">
            {reveal ? "숨기기" : "보기"}
          </Button>
        </div>
      </label>
      <label className="grid gap-1.5 text-sm" htmlFor={`${idBase}-model`}>
        <span className="text-ink-soft">모델 이름</span>
        <Input id={`${idBase}-model`} aria-label={`${provider.label} 모델`} value={model} maxLength={MODEL_MAX_LENGTH} onChange={(event) => setModel(event.target.value)} placeholder={provider.defaultModel} className="h-11 text-base lg:h-9 lg:text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-tune-bad">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} className="h-11 rounded-full px-5 text-sm lg:h-9">{saved ? "저장" : "키 저장"}</Button>
        {saved && (
          <>
            <label className="flex min-h-11 items-center gap-2 text-sm lg:min-h-9">
              <input
                type="checkbox"
                aria-label={`${provider.label} 사용`}
                checked={config.enabled}
                onChange={(event) => onChange(saveLlmConfig(provider.id, { enabled: event.target.checked }))}
                className="size-4 accent-accent"
              />
              사용
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onChange(clearLlmConfig(provider.id)); setModel(provider.defaultModel); setDraftKey(""); toast.success(`${provider.label} 키를 지웠어요`); }}
              className="h-11 rounded-full px-5 text-sm text-destructive lg:h-9"
            >
              키 삭제
            </Button>
          </>
        )}
        <a href={provider.keyPageUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-ink-soft underline underline-offset-2">키 발급 페이지</a>
      </div>
      <p className="text-xs text-ink-soft">{provider.formatHint}</p>
    </article>
  );
}

/** LLM API 키(OpenAI·Claude·Gemini). 키는 이 기기에만 저장하고 서버로 보내지 않는다. */
export function LlmApiSection() {
  const [configs, setConfigs] = useState<LlmConfigs>(emptyConfigs);
  useEffect(() => {
    const t = setTimeout(() => setConfigs(loadLlmConfigs()), 0); // 하이드레이션 뒤 저장값 복원
    return () => clearTimeout(t);
  }, []);

  return (
    <SettingsSection id="llm" title="LLM API" description="OpenAI·Claude·Gemini 키를 등록해 두면 AI 기능에서 쓸 수 있어요.">
      <p className="rounded-lg bg-section p-3 text-xs leading-relaxed text-ink-soft" data-testid="llm-privacy-note">
        키는 <strong>이 기기의 브라우저 저장소에만</strong> 보관해요. HumScore 서버로 보내거나 계정에 동기화하지 않고, 악보 데이터와도 따로 저장해요.
        공용 기기에서는 사용 후 키를 삭제해 주세요. 음성(오디오)은 AI로 전송하지 않아요.
      </p>
      <div className="grid min-w-0 gap-3 xl:grid-cols-3">
        {LLM_PROVIDERS.map((provider) => (
          <ProviderCard key={`${provider.id}:${configs[provider.id].model}:${configs[provider.id].apiKey === "" ? "empty" : "saved"}`} provider={provider} config={configs[provider.id]} onChange={setConfigs} />
        ))}
      </div>
    </SettingsSection>
  );
}
