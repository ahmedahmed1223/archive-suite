/**
 * AiProvider port — assisted archiving capabilities supplied by local or
 * server-backed AI adapters.
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
] as const;

export type AiProviderMethod = typeof AI_PROVIDER_METHODS[number];
export type AiProviderPort = Record<AiProviderMethod, (...args: unknown[]) => unknown>;

export function isAiProvider(candidate: unknown): candidate is AiProviderPort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return AI_PROVIDER_METHODS.every((method) => typeof record[method] === "function");
}
