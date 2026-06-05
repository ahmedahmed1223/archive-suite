/**
 * AiProvider port — the forward-looking seam for the assisted-archiving layer
 * identified in the CLOUD-MediaDB survey (transcription, summarization, tag
 * suggestion, Arabic proofreading, field autocomplete, document chat, semantic
 * search ranking).
 *
 * The default (offline SPA) adapter reports `isAvailable() === false` and
 * rejects the generative calls — no API keys ship in the SPA bundle. The cloud
 * target wires a server-proxied adapter (Gemini/OpenAI/OpenRouter); an in-browser
 * `ai-local-xenova` transcription adapter can satisfy `transcribe` even offline.
 *
 * Methods:
 *  isAvailable()                          -> boolean
 *  transcribe({ blob, mimeType, name })   -> Promise<{ transcription, segments? }>
 *  summarize({ text })                    -> Promise<{ summary, tags }>
 *  suggestTags({ name, summary, transcription, categories }) -> Promise<{ tags, categoryIds }>
 *  proofread({ text })                    -> Promise<{ correctedText, corrections }>
 *  autocompleteFields({ name, summary, transcription, categories }) -> Promise<{...}>
 *  chat({ context, query, history })      -> Promise<string>
 *  rankSearch({ query, items })           -> Promise<items>
 */
export const AI_PROVIDER_METHODS = [
  "isAvailable",
  "transcribe",
  "summarize",
  "suggestTags",
  "proofread",
  "autocompleteFields",
  "chat",
  "rankSearch"
];

export function isAiProvider(candidate) {
  return Boolean(candidate) && AI_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
