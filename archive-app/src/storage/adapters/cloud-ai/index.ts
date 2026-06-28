// Cloud AI adapter — the SPA's AiProvider implementation that proxies every
// generative call to the archive-server's /api/ai/rpc. Provider keys live on
// the server (env), never in the SPA bundle. The server decides which AI
// backend (OpenRouter / OpenAI / Gemini / Anthropic / ...) actually runs.
//
// One method = one RPC call, mirroring the storage cloud-http adapter so the
// AiProvider contract can't drift.

const AI_RPC_METHODS = ["summarize", "suggestTags", "proofread", "autocompleteFields", "chat", "rankSearch"] as const;

type FetchLike = typeof fetch;

export class CloudAiError extends Error {
  status?: number;
  method?: string;

  constructor(message: string, { status, method }: { status?: number; method?: string } = {}) {
    super(message);
    this.name = "CloudAiError";
    this.status = status;
    this.method = method;
  }
}

export function createCloudAiProvider({
  baseUrl = "",
  getToken,
  fetchImpl,
  onUnauthorized
}: {
  baseUrl?: string;
  getToken?: () => string;
  fetchImpl?: FetchLike;
  onUnauthorized?: () => void;
} = {}) {
  const doFetch = (fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined)) as FetchLike;
  if (!doFetch) throw new Error("cloud-ai adapter needs a fetch implementation.");
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const endpoint = `${base}/api/ai/rpc`;
  const transcribeEndpoint = `${base}/api/ai/transcribe`;

  async function rpc(method: string, args: any[]) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = typeof getToken === "function" ? getToken() : "";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await doFetch(endpoint, { method: "POST", headers, body: JSON.stringify({ method, args }) });
    } catch (networkError: any) {
      throw new CloudAiError(`تعذّر الاتصال بخدمة الذكاء (${method}): ${networkError?.message || "خطأ شبكة"}`, { method });
    }
    if (response.status === 401 && typeof onUnauthorized === "function") {
      try { onUnauthorized(); } catch {
        // ignore
      }
    }
    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new CloudAiError(`استجابة غير صالحة من خدمة الذكاء (${method}).`, { status: response.status, method });
    }
    if (!response.ok || !payload?.ok) {
      // 503 = AI not configured on the server — surface a clear, localized hint.
      const msg = response.status === 503
        ? "خدمة الذكاء غير مُفعّلة على الخادم. هيّئ مزوّدًا في إعدادات الخادم."
        : (payload?.error || `فشل طلب الذكاء (${method}) برمز ${response.status}.`);
      throw new CloudAiError(msg, { status: response.status, method });
    }
    return payload.result;
  }

  const provider: Record<string, any> = {
    // Cloud target has AI capability wired; the server enforces actual
    // availability (a 503 from a generative call means "not configured there").
    isAvailable() {
      return true;
    },
    // Transcription = raw audio upload (not JSON-RPC). POSTs the blob with its
    // Content-Type to /api/ai/transcribe; the server forwards to the configured
    // Whisper provider (openai/groq/whisper-local) and returns { transcription,
    // segments }.
    async transcribe({ blob, mimeType, name }: { blob?: Blob; mimeType?: string; name?: string } = {}) {
      if (!blob) throw new CloudAiError("لا يوجد ملف صوت للتفريغ.", { method: "transcribe" });
      const headers: Record<string, string> = { "Content-Type": mimeType || blob.type || "application/octet-stream" };
      if (name) headers["X-Filename"] = encodeURIComponent(name);
      const token = typeof getToken === "function" ? getToken() : "";
      if (token) headers.Authorization = `Bearer ${token}`;

      let response: Response;
      try {
        response = await doFetch(transcribeEndpoint, { method: "POST", headers, body: blob });
      } catch (networkError: any) {
        throw new CloudAiError(`تعذّر الاتصال بخدمة التفريغ: ${networkError?.message || "خطأ شبكة"}`, { method: "transcribe" });
      }
      if (response.status === 401 && typeof onUnauthorized === "function") {
        try { onUnauthorized(); } catch {
          // ignore
        }
      }
      let payload: any;
      try {
        payload = await response.json();
      } catch {
        throw new CloudAiError("استجابة غير صالحة من خدمة التفريغ.", { status: response.status, method: "transcribe" });
      }
      if (!response.ok || !payload?.ok) {
        const msg = response.status === 503
          ? "التفريغ الصوتي غير مُفعّل على الخادم. هيّئ مزوّد Whisper في إعدادات الخادم."
          : (payload?.error || `فشل التفريغ برمز ${response.status}.`);
        throw new CloudAiError(msg, { status: response.status, method: "transcribe" });
      }
      return payload.result;
    }
  };
  for (const method of AI_RPC_METHODS) {
    provider[method] = (...args: any[]) => rpc(method, args);
  }
  return provider;
}
