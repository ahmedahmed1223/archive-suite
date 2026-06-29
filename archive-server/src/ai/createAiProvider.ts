import { createSdkAiProvider } from "./sdkProvider.js";
import { createCloudAiProvider } from "./aiProvider.js";
import { createTranscriber } from "./transcription.js";
import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("ai");

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

interface AiProviderConfig {
  impl?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  transcribe?: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
}

interface AiProvider {
  isAvailable(): boolean;
  transcribe(input?: { blob?: Blob; mimeType?: string; name?: string }): Promise<{ transcription: string; segments?: Array<unknown> }>;
  summarize(input?: unknown): Promise<unknown>;
  suggestTags(input?: unknown): Promise<unknown>;
  proofread(input?: unknown): Promise<unknown>;
  autocompleteFields(input?: unknown): Promise<unknown>;
  chat(input?: unknown): Promise<string>;
  rankSearch(input?: unknown): Promise<unknown>;
}

/**
 * @param cfg - { provider, apiKey, model, baseUrl, impl, transcribe:{provider,apiKey,model,baseUrl} }
 */
export function createAiProvider(cfg: AiProviderConfig = {}): AiProvider {
  const impl = cfg.impl || config.aiImpl;

  let base: ReturnType<typeof createCloudAiProvider> | ReturnType<typeof createSdkAiProvider>;
  if (impl === "manual") {
    base = createCloudAiProvider(cfg);
  } else {
    try {
      base = createSdkAiProvider(cfg);
    } catch (error) {
      // SDK couldn't build this provider (unsupported / missing key) — fall back
      // to the hand-rolled client so AI still works where possible.
      log.warn({ err: error }, "SDK provider unavailable; falling back to manual client.");
      base = createCloudAiProvider(cfg);
    }
  }

  // Attach transcription if a Whisper provider is configured.
  const tcfg = cfg.transcribe || {};
  if (tcfg.provider) {
    try {
      const transcriber = createTranscriber({ provider: tcfg.provider, apiKey: tcfg.apiKey, model: tcfg.model, baseUrl: tcfg.baseUrl });
      const withTranscribe: AiProvider = {
        ...base,
        transcribe: ({ blob, mimeType, name }: { blob?: Blob; mimeType?: string; name?: string } = {}) => transcriber.transcribe(blob, { mimeType, name })
      };
      return withTranscribe;
    } catch (error) {
      log.warn({ err: error }, "Transcription provider unavailable.");
    }
  }
  return base as AiProvider;
}
