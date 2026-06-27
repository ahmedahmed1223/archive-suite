/**
 * SessionProvider port — cloud/session identity lifecycle.
 */
export const SESSION_PROVIDER_METHODS = ["signIn", "signOut", "getCurrentUser", "getToken", "onChange"] as const;

export type SessionProviderMethod = typeof SESSION_PROVIDER_METHODS[number];
export type SessionProviderPort = Record<SessionProviderMethod, (...args: unknown[]) => unknown>;

export function isSessionProvider(candidate: unknown): candidate is SessionProviderPort {
  if (!candidate || typeof candidate !== "object") return false;
  const record = candidate as Record<string, unknown>;
  return SESSION_PROVIDER_METHODS.every((method) => typeof record[method] === "function");
}
