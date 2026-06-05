/**
 * AuthProvider port — the credential contract the app depends on, independent
 * of where identities live. The local adapter wraps the existing bcrypt/SHA
 * utilities (offline SPA); the cloud adapter (later) implements the same shape
 * over PocketBase auth. Feature code never names a concrete auth backend.
 *
 * Methods:
 *  hashSecret(plain)            -> Promise<string>   salted/slow hash
 *  verifySecret(plain, stored)  -> Promise<boolean>  constant-time-ish compare
 *  validateStrength(plain)      -> string[]          policy errors (empty = valid)
 *  isLegacyHash(stored)         -> boolean           needs-rehash flag
 *
 * Session methods (signIn/signOut/currentUser/onChange) belong to the cloud
 * target and arrive with the PocketBase adapter; the SPA keeps its store-owned
 * master-password session, so they are intentionally NOT part of this contract
 * yet (YAGNI — added when a remote session actually exists).
 */
export const AUTH_PROVIDER_METHODS = ["hashSecret", "verifySecret", "validateStrength", "isLegacyHash"];

export function isAuthProvider(candidate) {
  return Boolean(candidate) && AUTH_PROVIDER_METHODS.every((method) => typeof candidate[method] === "function");
}
