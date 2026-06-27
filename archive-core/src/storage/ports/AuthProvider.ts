/**
 * AuthProvider port — the credential contract the app depends on, independent
 * of where identities live.
 */
export const AUTH_PROVIDER_METHODS = ["hashSecret", "verifySecret", "validateStrength", "isLegacyHash"] as const;

export type AuthProviderMethod = typeof AUTH_PROVIDER_METHODS[number];
export type AuthProviderPort = Record<AuthProviderMethod, (...args: unknown[]) => unknown>;

export function isAuthProvider(candidate: unknown): candidate is AuthProviderPort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return AUTH_PROVIDER_METHODS.every((method) => typeof record[method] === "function");
}
