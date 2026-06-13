/**
 * The default AiProvider adapter for the offline SPA: assisted features are
 * unavailable until a provider is configured (cloud server proxy, or the
 * in-browser `ai-local-xenova` transcription adapter). No API keys ship here.
 *
 * `isAvailable()` is false so the UI can hide/disable AI affordances cleanly;
 * the generative calls reject with a clear, localized message rather than
 * silently returning empty data.
 */
const UNAVAILABLE = "خدمة الذكاء الاصطناعي غير مُهيّأة في هذا الهدف. هيّئ مزوّدًا من الإعدادات (النسخة السحابية) أو فعّل التفريغ المحلي.";

function reject() {
  return Promise.reject(new Error(UNAVAILABLE));
}

export const localAiStubProvider = {
  isAvailable() {
    return false;
  },
  transcribe: reject,
  summarize: reject,
  suggestTags: reject,
  proofread: reject,
  autocompleteFields: reject,
  chat: reject,
  rankSearch: reject
};
