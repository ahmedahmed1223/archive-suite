export function resolveAuthSigningSecret(env = process.env) {
  return String(env.JWT_AUTH_SECRET || env.JWT_SECRET || "").trim();
}
