// AI provider registry — one place that knows how to reach every supported
// AI API. OpenRouter is the unified gateway, but direct providers are first
// class too. Most speak the OpenAI chat-completions shape, so a single client
// covers them by swapping baseUrl + auth; Anthropic uses its native Messages
// API (kind: "anthropic").
//
// Keys are NEVER in the SPA — these are used server-side only (env-injected),
// proxied to the browser via /api/ai/*.

/**
 * kind:
 *   "openai"    → POST {baseUrl}/chat/completions, Authorization: Bearer
 *   "anthropic" → POST {baseUrl}/v1/messages,      x-api-key + anthropic-version
 */
export const AI_PROVIDERS = Object.freeze({
  openrouter: {
    label: "OpenRouter (بوّابة موحّدة لكل النماذج)",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini"
  },
  openai: {
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini"
  },
  google: {
    label: "Google Gemini (واجهة متوافقة مع OpenAI)",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash"
  },
  anthropic: {
    label: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-3-5-haiku-latest"
  },
  groq: {
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile"
  },
  together: {
    label: "Together AI",
    kind: "openai",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo"
  },
  deepseek: {
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat"
  },
  mistral: {
    label: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest"
  },
  xai: {
    label: "xAI Grok",
    kind: "openai",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest"
  },
  ollama: {
    label: "Ollama / محلي (متوافق مع OpenAI)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2"
  }
});

/** List provider ids + labels for a settings dropdown. */
export function listAiProviders() {
  return Object.entries(AI_PROVIDERS).map(([id, p]) => ({ id, label: p.label, defaultModel: p.defaultModel }));
}

/**
 * Resolve a provider config, allowing per-call overrides for baseUrl/model so
 * a self-hosted gateway or custom OpenAI-compatible endpoint works too.
 * @throws {Error} 400 when the provider id is unknown
 */
export function resolveAiProvider(id, overrides = {}) {
  const base = AI_PROVIDERS[id];
  if (!base) {
    const err = new Error(`Unknown AI provider: ${String(id)}. Supported: ${Object.keys(AI_PROVIDERS).join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
  return {
    id,
    kind: base.kind,
    baseUrl: (overrides.baseUrl || base.baseUrl).replace(/\/+$/, ""),
    model: overrides.model || base.defaultModel,
    label: base.label
  };
}
