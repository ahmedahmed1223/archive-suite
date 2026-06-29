import { resolveAiProvider } from "./providers.js";

// Unified chat client across every provider in the registry. Normalizes two
// wire shapes (OpenAI chat-completions + Anthropic Messages) behind one
// `chat(messages, options)` returning the assistant text. Injectable fetch +
// no SDK → deterministic offline tests.

export class AiError extends Error {
  name = "AiError";
  status?: number;
  provider?: string;

  constructor(message: string, { status, provider }: { status?: number; provider?: string } = {}) {
    super(message);
    this.status = status;
    this.provider = provider;
  }
}

interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface AiProvider {
  id: string;
  kind: "openai" | "anthropic";
  baseUrl: string;
  model: string;
  label: string;
}

interface AiChatClient {
  provider: AiProvider;
  chat(messages: AiMessage[], options?: ChatOptions): Promise<string>;
}

/**
 * @param cfg - { provider, apiKey, model?, baseUrl?, fetchImpl }
 * @param cfg.provider - registry id (openrouter, openai, anthropic, …)
 * @param cfg.apiKey - API key for the provider
 * @param cfg.model - overrides the provider default
 * @param cfg.baseUrl - overrides the provider base (self-hosted gateways)
 * @param cfg.fetchImpl - injectable fetch for testing
 * @param cfg.appUrl - OpenRouter attribution header
 * @param cfg.appTitle - OpenRouter attribution header
 */
export function createAiChatClient(cfg: {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  appUrl?: string;
  appTitle?: string;
} = {}): AiChatClient {
  const { apiKey, fetchImpl, appUrl, appTitle } = cfg;
  const provider = resolveAiProvider(cfg.provider || "openai", { baseUrl: cfg.baseUrl, model: cfg.model });
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("AI chat client needs a fetch implementation.");
  if (!apiKey && provider.id !== "ollama") {
    throw new AiError(`AI provider "${provider.id}" requires an API key.`, { provider: provider.id });
  }

  async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await (doFetch || fetch)(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    } catch (networkError) {
      const err = networkError as Error | null;
      throw new AiError(`تعذّر الاتصال بمزوّد الذكاء (${provider.id}): ${err?.message || "خطأ شبكة"}`, { provider: provider.id });
    }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new AiError(`استجابة غير صالحة من ${provider.id}.`, { status: response.status, provider: provider.id }); }
    if (!response.ok) {
      const errorPayload = payload as Record<string, unknown> | null;
      const msg = errorPayload?.error && typeof errorPayload.error === "object"
        ? (errorPayload.error as Record<string, unknown>).message
        : errorPayload?.error
        ? String(errorPayload.error)
        : `طلب الذكاء فشل (${response.status}).`;
      throw new AiError(typeof msg === "string" ? msg : JSON.stringify(msg), { status: response.status, provider: provider.id });
    }
    return payload;
  }

  /**
   * Chat with the AI provider.
   * @param messages - conversation messages
   * @param options - { json: bool, temperature, maxTokens }
   * @returns assistant text
   */
  async function chat(messages: AiMessage[], options: ChatOptions = {}): Promise<string> {
    const { json = false, temperature = 0.3, maxTokens = 1024 } = options;

    if (provider.kind === "anthropic") {
      // Anthropic splits the system prompt out of `messages`.
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const payload = await postJson(`${provider.baseUrl}/v1/messages`, {
        "x-api-key": apiKey || "",
        "anthropic-version": "2023-06-01"
      }, {
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: rest
      }) as Record<string, unknown>;
      const content = payload?.content as Array<{ text?: string }> | undefined;
      const text = Array.isArray(content) ? content.map((c) => c.text || "").join("") : "";
      return text;
    }

    // OpenAI-compatible (openai, openrouter, google, groq, together, …)
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey || "ollama"}` };
    if (provider.id === "openrouter") {
      if (appUrl) headers["HTTP-Referer"] = appUrl;
      if (appTitle) headers["X-Title"] = appTitle;
    }
    const payload = await postJson(`${provider.baseUrl}/chat/completions`, headers, {
      model: provider.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {})
    }) as Record<string, unknown>;
    const choices = payload?.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content || "";
  }

  return { provider, chat };
}

/**
 * Parse a model reply that should be JSON, tolerant of ```json fences.
 */
export function parseJsonReply(text: string, fallback: unknown = {}): unknown {
  if (typeof text !== "string" || !text.trim()) return fallback;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { /* try to find first {...} */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return fallback;
}
