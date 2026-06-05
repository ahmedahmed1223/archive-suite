import { resolveAiProvider } from "./providers.js";

// Unified chat client across every provider in the registry. Normalizes two
// wire shapes (OpenAI chat-completions + Anthropic Messages) behind one
// `chat(messages, options)` returning the assistant text. Injectable fetch +
// no SDK → deterministic offline tests.

export class AiError extends Error {
  constructor(message, { status, provider } = {}) {
    super(message);
    this.name = "AiError";
    this.status = status;
    this.provider = provider;
  }
}

/**
 * @param {object} cfg
 * @param {string} cfg.provider - registry id (openrouter, openai, anthropic, …)
 * @param {string} cfg.apiKey
 * @param {string} [cfg.model] - overrides the provider default
 * @param {string} [cfg.baseUrl] - overrides the provider base (self-hosted gateways)
 * @param {typeof fetch} [cfg.fetchImpl]
 * @param {string} [cfg.appUrl] / [cfg.appTitle] - OpenRouter attribution headers
 */
export function createAiChatClient(cfg = {}) {
  const { apiKey, fetchImpl, appUrl, appTitle } = cfg;
  const provider = resolveAiProvider(cfg.provider, { baseUrl: cfg.baseUrl, model: cfg.model });
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("AI chat client needs a fetch implementation.");
  if (!apiKey && provider.id !== "ollama") {
    throw new AiError(`AI provider "${provider.id}" requires an API key.`, { provider: provider.id });
  }

  async function postJson(url, headers, body) {
    let response;
    try {
      response = await doFetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    } catch (networkError) {
      throw new AiError(`تعذّر الاتصال بمزوّد الذكاء (${provider.id}): ${networkError?.message || "خطأ شبكة"}`, { provider: provider.id });
    }
    let payload;
    try { payload = await response.json(); } catch { throw new AiError(`استجابة غير صالحة من ${provider.id}.`, { status: response.status, provider: provider.id }); }
    if (!response.ok) {
      const msg = payload?.error?.message || payload?.error || `طلب الذكاء فشل (${response.status}).`;
      throw new AiError(typeof msg === "string" ? msg : JSON.stringify(msg), { status: response.status, provider: provider.id });
    }
    return payload;
  }

  /**
   * @param {Array<{role:"system"|"user"|"assistant", content:string}>} messages
   * @param {object} [options] - { json: bool, temperature, maxTokens }
   * @returns {Promise<string>} assistant text
   */
  async function chat(messages, options = {}) {
    const { json = false, temperature = 0.3, maxTokens = 1024 } = options;

    if (provider.kind === "anthropic") {
      // Anthropic splits the system prompt out of `messages`.
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
      const payload = await postJson(`${provider.baseUrl}/v1/messages`, {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }, {
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: rest
      });
      const text = Array.isArray(payload?.content) ? payload.content.map((c) => c.text || "").join("") : "";
      return text;
    }

    // OpenAI-compatible (openai, openrouter, google, groq, together, …)
    const headers = { Authorization: `Bearer ${apiKey || "ollama"}` };
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
    });
    return payload?.choices?.[0]?.message?.content || "";
  }

  return { provider, chat };
}

/** Parse a model reply that should be JSON, tolerant of ```json fences. */
export function parseJsonReply(text, fallback = {}) {
  if (typeof text !== "string" || !text.trim()) return fallback;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { /* try to find first {...} */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
  return fallback;
}
