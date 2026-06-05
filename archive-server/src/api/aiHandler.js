import { getAiProvider } from "@archive/core";

// AI RPC dispatcher — mirrors the storage rpcHandler but for the AiProvider
// port. Allow-listed so the endpoint can only invoke the intended AI methods.
// `transcribe` is excluded: it needs a binary blob (not JSON-RPC friendly) and
// the chat client doesn't support it anyway.
export const AI_RPC_METHODS = Object.freeze([
  "isAvailable", "summarize", "suggestTags", "proofread",
  "autocompleteFields", "chat", "rankSearch"
]);

export async function dispatchAi(request, { resolveProvider = getAiProvider } = {}) {
  const method = request?.method;
  const args = Array.isArray(request?.args) ? request.args : [];

  if (typeof method !== "string" || !AI_RPC_METHODS.includes(method)) {
    const err = new Error(`Unknown AI method: ${String(method)}`);
    err.statusCode = 400;
    throw err;
  }

  let provider;
  try {
    provider = resolveProvider();
  } catch {
    // No AiProvider registered → AI not configured on this server.
    const err = new Error("AI is not configured on this server.");
    err.statusCode = 503;
    throw err;
  }

  const fn = provider?.[method];
  if (typeof fn !== "function") {
    const err = new Error(`Active AI provider does not implement "${method}"`);
    err.statusCode = 500;
    throw err;
  }
  return fn.apply(provider, args);
}
