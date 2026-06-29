// Speech-to-text (Whisper) — server-side, multi-provider. OpenAI, Groq, and
// self-hosted faster-whisper/speaches all speak the SAME OpenAI
// `/audio/transcriptions` multipart shape, so one client covers them by
// swapping baseUrl + auth + model. Keys stay server-side.
//
// Two deployment styles, user-selectable (TRANSCRIBE_PROVIDER):
//   openai / groq  → hosted Whisper API (needs key)
//   whisper-local  → self-hosted container (TRANSCRIBE_BASE_URL, no key)

interface TranscribeProviderConfig {
  label: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
}

interface TranscribeProviderOption {
  id: string;
  label: string;
  needsKey: boolean;
}

interface ResolvedTranscribeProvider {
  id: string;
  baseUrl: string;
  model: string;
  needsKey: boolean;
  label: string;
}

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  transcription: string;
  segments?: TranscriptionSegment[];
}

export const TRANSCRIBE_PROVIDERS: Readonly<Record<string, TranscribeProviderConfig>> = Object.freeze({
  openai: {
    label: "OpenAI Whisper",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "whisper-1",
    needsKey: true
  },
  groq: {
    label: "Groq Whisper (سريع)",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "whisper-large-v3",
    needsKey: true
  },
  "whisper-local": {
    label: "Whisper ذاتي الاستضافة (حاوية)",
    baseUrl: "http://whisper:8000/v1", // faster-whisper-server / speaches default
    defaultModel: "Systran/faster-whisper-base",
    needsKey: false
  }
});

export function listTranscribeProviders(): TranscribeProviderOption[] {
  return Object.entries(TRANSCRIBE_PROVIDERS).map(([id, p]) => ({ id, label: p.label, needsKey: p.needsKey }));
}

export function resolveTranscribeProvider(id: string, overrides: { baseUrl?: string; model?: string } = {}): ResolvedTranscribeProvider {
  const base = TRANSCRIBE_PROVIDERS[id];
  if (!base) {
    const err = new Error(`Unknown transcription provider: ${String(id)}. Supported: ${Object.keys(TRANSCRIBE_PROVIDERS).join(", ")}`);
    (err as any).statusCode = 400;
    throw err;
  }
  return {
    id,
    baseUrl: (overrides.baseUrl || base.baseUrl).replace(/\/+$/, ""),
    model: overrides.model || base.defaultModel,
    needsKey: base.needsKey,
    label: base.label
  };
}

export class TranscribeError extends Error {
  name = "TranscribeError";
  status?: number;
  provider?: string;

  constructor(message: string, { status, provider }: { status?: number; provider?: string } = {}) {
    super(message);
    this.status = status;
    this.provider = provider;
  }
}

/**
 * @param cfg - { provider, apiKey, model, baseUrl, fetchImpl }
 * @returns {{ provider, transcribe }} where transcribe(audio, {mimeType,name}) →
 *          Promise<{ transcription: string, segments?: Array }>
 */
export function createTranscriber(cfg: {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
} = {}) {
  const p = resolveTranscribeProvider(cfg.provider || "openai", { baseUrl: cfg.baseUrl, model: cfg.model });
  const doFetch = cfg.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("transcriber needs a fetch implementation.");
  if (p.needsKey && !cfg.apiKey) {
    const err = new Error(`Transcription provider "${p.id}" requires an API key.`);
    (err as any).statusCode = 400;
    throw err;
  }

  async function transcribe(audio: Blob | Buffer | Uint8Array | undefined, { mimeType = "audio/mpeg", name = "audio" }: { mimeType?: string; name?: string } = {}): Promise<TranscriptionResult> {
    // audio: Buffer | Uint8Array | Blob. Build the OpenAI multipart form.
    let blob: Blob;
    if (audio instanceof Blob) {
      blob = audio;
    } else {
      // Convert Buffer or Uint8Array to ArrayBuffer for Blob
      const arrayBuffer = audio instanceof Buffer
        ? audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
        : (audio ? audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) : new ArrayBuffer(0));
      blob = new Blob([arrayBuffer], { type: mimeType });
    }
    const form = new FormData();
    form.append("file", blob, name);
    form.append("model", p.model);
    form.append("response_format", "verbose_json"); // includes segments + timings

    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    let response: Response;
    try {
      response = await (doFetch || fetch)(`${p.baseUrl}/audio/transcriptions`, { method: "POST", headers, body: form });
    } catch (networkError) {
      const err = networkError as Error | null;
      throw new TranscribeError(`تعذّر الاتصال بخدمة التفريغ (${p.id}): ${err?.message || "خطأ شبكة"}`, { provider: p.id });
    }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new TranscribeError(`استجابة غير صالحة من ${p.id}.`, { status: response.status, provider: p.id }); }
    if (!response.ok) {
      const errorPayload = payload as Record<string, unknown> | null;
      const msg = errorPayload?.error && typeof errorPayload.error === "object"
        ? (errorPayload.error as Record<string, unknown>).message
        : errorPayload?.error
        ? String(errorPayload.error)
        : `فشل التفريغ (${response.status}).`;
      throw new TranscribeError(typeof msg === "string" ? msg : JSON.stringify(msg), { status: response.status, provider: p.id });
    }
    const result = payload as Record<string, unknown>;
    const text = typeof result.text === "string" ? result.text : "";
    return {
      transcription: text,
      segments: Array.isArray(result.segments)
        ? (result.segments as Array<{ start?: number; end?: number; text?: string }>).map((s) => ({ start: s.start || 0, end: s.end || 0, text: s.text || "" }))
        : undefined
    };
  }

  return { provider: p, transcribe };
}
