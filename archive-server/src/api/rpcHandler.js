import { getStorageProvider } from "@archive/core";

import { validateRpcArgs } from "./validate.js";

// The StorageProvider port methods, allow-listed so the RPC endpoint can
// never be coerced into calling an arbitrary property on the provider object.
// getByField is an optional extension — included here so the SPA can call it
// directly; the provider check below still handles missing implementations.
export const RPC_METHODS = Object.freeze([
  "open", "get", "getAll", "put", "add", "delete", "clear",
  "putBatch", "deleteBatch", "snapshot", "replaceAll",
  "getByField"
]);

/**
 * Pure RPC dispatcher — resolves the active StorageProvider and invokes one
 * of its allow-listed methods with the given args. Kept free of HTTP so it's
 * unit-testable with an injected provider.
 *
 * @param {{method: string, args: unknown[]}} request
 * @param {object} [options]
 * @param {() => object} [options.resolveProvider] - defaults to the core registry getter
 * @returns {Promise<unknown>} the method's result
 * @throws {Error} with `.statusCode` when the method is unknown / args invalid
 */
export async function dispatchRpc(request, { resolveProvider = getStorageProvider } = {}) {
  const method = request?.method;
  const args = Array.isArray(request?.args) ? request.args : [];

  if (typeof method !== "string" || !RPC_METHODS.includes(method)) {
    const err = new Error(`Unknown RPC method: ${String(method)}`);
    err.statusCode = 400;
    throw err;
  }

  // Reject malformed args at the edge (throws 400 on bad shape).
  validateRpcArgs(method, args);

  const provider = resolveProvider();
  const fn = provider?.[method];
  if (typeof fn !== "function") {
    const err = new Error(`Active provider does not implement "${method}"`);
    err.statusCode = 500;
    throw err;
  }

  return fn.apply(provider, args);
}
