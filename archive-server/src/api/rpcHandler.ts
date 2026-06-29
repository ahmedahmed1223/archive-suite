import { getStorageProvider } from "@archive/core";

import { validateRpcArgs } from "./validate.js";
import { canCallRpc } from "../auth/roles.js";

// The StorageProvider port methods, allow-listed so the RPC endpoint can
// never be coerced into calling an arbitrary property on the provider object.
// getByField is an optional extension — included here so the SPA can call it
// directly; the provider check below still handles missing implementations.
export const RPC_METHODS = Object.freeze([
  "open", "get", "getAll", "put", "add", "delete", "clear",
  "putBatch", "deleteBatch", "snapshot", "replaceAll",
  "getByField"
]);

interface RpcRequest {
  method?: string;
  args?: unknown[];
}

interface RpcOptions {
  resolveProvider?: () => unknown;
  user?: unknown;
}

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

/**
 * Pure RPC dispatcher — resolves the active StorageProvider and invokes one
 * of its allow-listed methods with the given args. Kept free of HTTP so it's
 * unit-testable with an injected provider.
 */
export async function dispatchRpc(request: RpcRequest, { resolveProvider = getStorageProvider, user = null }: RpcOptions = {}): Promise<unknown> {
  const method = request?.method;
  const args = Array.isArray(request?.args) ? request.args : [];

  if (typeof method !== "string" || !RPC_METHODS.includes(method)) {
    const err = new Error(`Unknown RPC method: ${String(method)}`);
    (err as ErrorWithStatus).statusCode = 400;
    throw err;
  }

  // RBAC: when a user is provided (auth is enabled), check role permission.
  // When user is null (auth disabled / unauthenticated mode), skip — the
  // server logs a startup warning about unauthenticated mode separately.
  if (user !== null && user !== undefined && !canCallRpc(user as any, method)) {
    const err = new Error("Forbidden: insufficient role for this operation");
    (err as ErrorWithStatus).statusCode = 403;
    throw err;
  }

  // Reject malformed args at the edge (throws 400 on bad shape).
  validateRpcArgs(method, args);

  const provider = resolveProvider();
  const fn = (provider as any)?.[method];
  if (typeof fn !== "function") {
    const err = new Error(`Active provider does not implement "${method}"`);
    (err as ErrorWithStatus).statusCode = 500;
    throw err;
  }

  return fn.apply(provider, args);
}
