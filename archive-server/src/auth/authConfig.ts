type AuthSecretEnv = {
  JWT_AUTH_SECRET?: string;
  JWT_SECRET?: string;
};

export function resolveAuthSigningSecret(env: AuthSecretEnv = process.env): string {
  return String(env.JWT_AUTH_SECRET || env.JWT_SECRET || "").trim();
}
