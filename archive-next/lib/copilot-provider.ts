import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";

export type CopilotProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "groq"
  | "mistral"
  | "xai"
  | "deepseek"
  | "openrouter"
  | "openai-compatible";

export interface CopilotProviderResolution {
  ready: boolean;
  provider: CopilotProviderName;
  model: string | null;
  languageModel: LanguageModel | null;
}

/** Providers backed by a plain `create<Provider>({ apiKey })(model)` factory. */
type SimpleProviderName = "anthropic" | "openai" | "google" | "groq" | "mistral" | "xai" | "deepseek";

interface SimpleProviderConfig {
  envKey: string;
  defaultModel: string;
  create: (apiKey: string) => (model: string) => LanguageModel;
}

const SIMPLE_PROVIDERS: Record<SimpleProviderName, SimpleProviderConfig> = {
  anthropic: { envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-5", create: (apiKey) => createAnthropic({ apiKey }) },
  openai: { envKey: "OPENAI_API_KEY", defaultModel: "gpt-5", create: (apiKey) => createOpenAI({ apiKey }) },
  google: { envKey: "GOOGLE_GENERATIVE_AI_API_KEY", defaultModel: "gemini-2.5-flash", create: (apiKey) => createGoogleGenerativeAI({ apiKey }) },
  groq: { envKey: "GROQ_API_KEY", defaultModel: "llama-3.3-70b-versatile", create: (apiKey) => createGroq({ apiKey }) },
  mistral: { envKey: "MISTRAL_API_KEY", defaultModel: "mistral-large-latest", create: (apiKey) => createMistral({ apiKey }) },
  xai: { envKey: "XAI_API_KEY", defaultModel: "grok-4", create: (apiKey) => createXai({ apiKey }) },
  deepseek: { envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat", create: (apiKey) => createDeepSeek({ apiKey }) }
};

/** Providers routed through the OpenAI-compatible client (fixed or custom base URL). No default model — always explicit. */
type CompatProviderName = "openrouter" | "openai-compatible";

interface CompatProviderConfig {
  clientName: string;
  envKey: string;
  /** Fixed base URL (openrouter). Omit to read it from `baseUrlEnvKey` (openai-compatible). */
  baseURL?: string;
  baseUrlEnvKey?: string;
}

const COMPAT_PROVIDERS: Record<CompatProviderName, CompatProviderConfig> = {
  openrouter: { clientName: "openrouter", envKey: "OPENROUTER_API_KEY", baseURL: "https://openrouter.ai/api/v1" },
  "openai-compatible": { clientName: "archive-copilot-compat", envKey: "ARCHIVE_COPILOT_COMPAT_API_KEY", baseUrlEnvKey: "ARCHIVE_COPILOT_COMPAT_BASE_URL" }
};

function isCopilotProviderName(value: string): value is CopilotProviderName {
  return value in SIMPLE_PROVIDERS || value in COMPAT_PROVIDERS;
}

function notReady(provider: CopilotProviderName, model: string | null): CopilotProviderResolution {
  return { ready: false, provider, model, languageModel: null };
}

/**
 * Resolves the active copilot provider, model, and Vercel AI SDK language
 * model from server-only env vars. Never throws on missing configuration —
 * callers check `ready` and return a generic 503 without leaking which key
 * or provider is missing.
 */
export function resolveCopilotProvider(environment: Record<string, string | undefined>): CopilotProviderResolution {
  const requested = environment.ARCHIVE_COPILOT_PROVIDER?.trim() || "anthropic";
  const provider: CopilotProviderName = isCopilotProviderName(requested) ? requested : "anthropic";
  const modelOverride = environment.ARCHIVE_COPILOT_MODEL?.trim();

  if (provider === "openrouter" || provider === "openai-compatible") {
    const compat = COMPAT_PROVIDERS[provider];
    const apiKey = environment[compat.envKey]?.trim();
    const baseURL = compat.baseURL ?? (compat.baseUrlEnvKey ? environment[compat.baseUrlEnvKey]?.trim() : undefined);
    // Both compat providers require an explicit model — there is no safe
    // cross-provider default to assume for an arbitrary endpoint.
    const model = modelOverride || null;
    if (!apiKey || !baseURL || !model) return notReady(provider, model);
    return {
      ready: true,
      provider,
      model,
      languageModel: createOpenAICompatible({ name: compat.clientName, apiKey, baseURL })(model)
    };
  }

  const config = SIMPLE_PROVIDERS[provider];
  // Legacy fallback: ARCHIVE_COPILOT_API_KEY predates the multi-provider
  // setup and only applies to anthropic.
  const legacyFallback = provider === "anthropic" ? environment.ARCHIVE_COPILOT_API_KEY?.trim() : undefined;
  const apiKey = environment[config.envKey]?.trim() || legacyFallback;
  const model = modelOverride || config.defaultModel;

  if (!apiKey) return notReady(provider, model);
  return { ready: true, provider, model, languageModel: config.create(apiKey)(model) };
}
