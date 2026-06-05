import { createSdkAiProvider } from "./sdkProvider.js";
import { createCloudAiProvider } from "./aiProvider.js";
import { createTranscriber } from "./transcription.js";

// AI implementation selector. Default is the Vercel AI SDK (validated
// structured output via generateObject + Zod, streaming/tools available). The
// hand-rolled fetch client is kept as a zero-dependency fallback, selectable
// with AI_IMPL=manual or used automatically if the SDK can't construct the
// chosen provider. Both satisfy the same @archive/core AiProvider port.
//
// Transcription is configured INDEPENDENTLY (transcribe.* options): a chat
// provider need not match the Whisper provider. When configured, the chosen
// AI provider's `transcribe` delegates to the transcriber; otherwise it
// rejects (no audio model).
//
// @param {object} cfg - { provider, apiKey, model, baseUrl, impl, transcribe:{provider,apiKey,model,baseUrl} }
export function createAiProvider(cfg = {}) {
  const impl = cfg.impl || process.env.AI_IMPL || "sdk";

  let base;
  if (impl === "manual") {
    base = createCloudAiProvider(cfg);
  } else {
    try {
      base = createSdkAiProvider(cfg);
    } catch (error) {
      // SDK couldn't build this provider (unsupported / missing key) — fall back
      // to the hand-rolled client so AI still works where possible.
      // eslint-disable-next-line no-console
      console.warn(`[archive-ai] SDK provider unavailable (${error?.message || error}); falling back to manual client.`);
      base = createCloudAiProvider(cfg);
    }
  }

  // Attach transcription if a Whisper provider is configured.
  const tcfg = cfg.transcribe || {};
  if (tcfg.provider) {
    try {
      const transcriber = createTranscriber(tcfg);
      return {
        ...base,
        transcribe: ({ blob, mimeType, name } = {}) => transcriber.transcribe(blob, { mimeType, name })
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[archive-ai] transcription unavailable (${error?.message || error}).`);
    }
  }
  return base;
}
