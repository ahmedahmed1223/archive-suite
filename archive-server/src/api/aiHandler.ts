import { getAiProvider } from "@archive/core";

export const AI_RPC_METHODS = Object.freeze([
  "isAvailable", "summarize", "suggestTags", "proofread",
  "autocompleteFields", "chat", "rankSearch"
]);

interface AiRequest {
  method?: string;
  args?: unknown[];
}

interface AiProvider {
  [key: string]: (...args: unknown[]) => Promise<unknown>;
}

export async function dispatchAi(request: AiRequest, { resolveProvider = getAiProvider } = { resolveProvider: getAiProvider }): Promise<unknown> {
  const method = request?.method;
  const args = Array.isArray(request?.args) ? request.args : [];

  if (typeof method !== "string" || !AI_RPC_METHODS.includes(method)) {
    const err = new Error(`Unknown AI method: ${String(method)}`);
    (err as any).statusCode = 400;
    throw err;
  }

  let provider: AiProvider;
  try {
    provider = resolveProvider() as AiProvider;
  } catch {
    const err = new Error("AI is not configured on this server.");
    (err as any).statusCode = 503;
    throw err;
  }

  const fn = provider?.[method];
  if (typeof fn !== "function") {
    const err = new Error(`Active AI provider does not implement "${method}"`);
    (err as any).statusCode = 500;
    throw err;
  }
  return fn.apply(provider, args);
}
