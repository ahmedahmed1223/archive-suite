// Speech-to-text (Whisper) — server-side, multi-provider. OpenAI, Groq, and
// self-hosted faster-whisper/speaches all speak the SAME OpenAI
// `/audio/transcriptions` multipart shape, so one client covers them by
// swapping baseUrl + auth + model. Keys stay server-side.
//
// Two deployment styles, user-selectable (TRANSCRIBE_PROVIDER):
//   openai / groq  → hosted Whisper API (needs key)
//   whisper-local  → self-hosted container (TRANSCRIBE_BASE_URL, no key)

export const TRANSCRIBE_PROVIDERS = Object.freeze({
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

export function listTranscribeProviders() {
  return Object.entries(TRANSCRIBE_PROVIDERS).map(([id, p]) => ({ id, label: p.label, needsKey: p.needsKey }));
}

export function resolveTranscribeProvider(id, overrides = {}) {
  const base = TRANSCRIBE_PROVIDERS[id];
  if (!base) {
    const err = new Error(`Unknown transcription provider: ${String(id)}. Supported: ${Object.keys(TRANSCRIBE_PROVIDERS).join(", ")}`);
    err.statusCode = 400;
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
  constructor(message, { status, provider } = {}) {
    super(message);
    this.name = "TranscribeError";
    this.status = status;
    this.provider = provider;
  }
}

/**
 * @param {object} cfg - { provider, apiKey, model, baseUrl, fetchImpl }
 * @returns {{ provider, transcribe }} where transcribe(audio, {mimeType,name}) →
 *          Promise<{ transcription: string, segments?: Array }>
 */
export function createTranscriber(cfg = {}) {
  const p = resolveTranscribeProvider(cfg.provider, { baseUrl: cfg.baseUrl, model: cfg.model });
  const doFetch = cfg.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("transcriber needs a fetch implementation.");
  if (p.needsKey && !cfg.apiKey) {
    const err = new Error(`Transcription provider "${p.id}" requires an API key.`);
    err.statusCode = 400;
    throw err;
  }

  async function transcribe(audio, { mimeType = "audio/mpeg", name = "audio" } = {}) {
    // audio: Buffer | Uint8Array | Blob. Build the OpenAI multipart form.
    const blob = audio instanceof Blob ? audio : new Blob([audio], { type: mimeType });
    const form = new FormData();
    form.append("file", blob, name);
    form.append("model", p.model);
    form.append("response_format", "verbose_json"); // includes segments + timings

    const headers = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    let response;
    try {
      response = await doFetch(`${p.baseUrl}/audio/transcriptions`, { method: "POST", headers, body: form });
    } catch (networkError) {
      throw new TranscribeError(`تعذّر الاتصال بخدمة التفريغ (${p.id}): ${networkError?.message || "خطأ شبكة"}`, { provider: p.id });
    }
    let payload;
    try { payload = await response.json(); } catch { throw new TranscribeError(`استجابة غير صالحة من ${p.id}.`, { status: response.status, provider: p.id }); }
    if (!response.ok) {
      const msg = payload?.error?.message || payload?.error || `فشل التفريغ (${response.status}).`;
      throw new TranscribeError(typeof msg === "string" ? msg : JSON.stringify(msg), { status: response.status, provider: p.id });
    }
    return {
      transcription: payload.text || "",
      segments: Array.isArray(payload.segments)
        ? payload.segments.map((s) => ({ start: s.start, end: s.end, text: s.text }))
        : undefined
    };
  }

  return { provider: p, transcribe };
}
