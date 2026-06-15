import type { LLMProvider } from "@/lib/types";

/** Static metadata for each LLM provider, shared by the client and the UI manager. */
export interface ProviderMeta {
  id: LLMProvider;
  label: string;
  /** Does this provider need an API key? (Ollama runs locally without one.) */
  needsKey: boolean;
  /** Can the user override the base URL? (Useful for proxies / self-hosted.) */
  supportsBaseUrl: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  keyPlaceholder: string;
  /** Where to grab a key — shown as a hint in the manager. */
  keysUrl?: string;
}

export const PROVIDER_META: Record<LLMProvider, ProviderMeta> = {
  ollama: {
    id: "ollama",
    label: "Ollama",
    needsKey: false,
    supportsBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    defaultModel: "qwen2.5-coder:7b",
    keyPlaceholder: "no key needed",
  },
  groq: {
    id: "groq",
    label: "Groq",
    needsKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_...",
    keysUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    needsKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    keyPlaceholder: "sk-or-...",
    keysUrl: "https://openrouter.ai/keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    needsKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-sonnet-latest",
    keyPlaceholder: "sk-ant-...",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI (or compatible)",
    needsKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
    keysUrl: "https://platform.openai.com/api-keys",
  },
};

export const ALL_LLM_PROVIDERS: LLMProvider[] = Object.keys(PROVIDER_META) as LLMProvider[];
