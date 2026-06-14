import type { LLMProvider } from "@/lib/types";

export interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Which providers are usable given current env / overrides. */
export function availableProviders(): LLMProvider[] {
  const out: LLMProvider[] = [];
  if (process.env.OLLAMA_BASE_URL) out.push("ollama");
  if (process.env.GROQ_API_KEY) out.push("groq");
  if (process.env.OPENROUTER_API_KEY) out.push("openrouter");
  if (process.env.ANTHROPIC_API_KEY) out.push("anthropic");
  if (process.env.OPENAI_API_KEY) out.push("openai");
  return out;
}

function resolve(cfg: LLMConfig) {
  const p = cfg.provider;
  const env = process.env;
  switch (p) {
    case "ollama":
      return {
        url: `${cfg.baseUrl ?? env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1/chat/completions`,
        model: cfg.model ?? env.OLLAMA_MODEL ?? "qwen2.5-coder:7b",
        key: "ollama",
      };
    case "groq":
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        model: cfg.model ?? env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        key: cfg.apiKey ?? env.GROQ_API_KEY ?? "",
      };
    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        model: cfg.model ?? env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet",
        key: cfg.apiKey ?? env.OPENROUTER_API_KEY ?? "",
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        model: cfg.model ?? env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
        key: cfg.apiKey ?? env.ANTHROPIC_API_KEY ?? "",
      };
    case "openai":
      return {
        url: `${cfg.baseUrl ?? env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`,
        model: cfg.model ?? env.OPENAI_MODEL ?? "gpt-4o-mini",
        key: cfg.apiKey ?? env.OPENAI_API_KEY ?? "",
      };
  }
}

/** Single non-streaming completion. Throws on upstream error. */
export async function chat(cfg: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const r = resolve(cfg);

  // Anthropic uses a different envelope.
  if (cfg.provider === "anthropic") {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch(r.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": r.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: r.model, max_tokens: 4096, system, messages: rest }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const d = await res.json();
    return d.content?.map((c: any) => c.text).join("") ?? "";
  }

  // OpenAI-compatible (ollama, groq, openrouter, openai).
  const res = await fetch(r.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(r.key && cfg.provider !== "ollama" ? { authorization: `Bearer ${r.key}` } : {}),
      ...(cfg.provider === "openrouter" ? { "HTTP-Referer": "https://github.com", "X-Title": "GitVibe" } : {}),
    },
    body: JSON.stringify({ model: r.model, messages, temperature: 0.3, stream: false }),
  });
  if (!res.ok) throw new Error(`${cfg.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content ?? "";
}
