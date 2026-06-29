import { createLogger } from "../logger.js";

const log = createLogger("productionGuard");

function envFlag(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function isDisabledFlag(value: unknown): boolean {
  return ["0", "false", "no", "off"].includes(
    String(value || "").trim().toLowerCase()
  );
}

export function isPublicProduction(env?: NodeJS.ProcessEnv): boolean {
  const envToCheck = env ?? process.env;
  if (isDisabledFlag(envToCheck.ARCHIVE_PUBLIC_DEPLOY)) return false;
  if (envFlag(envToCheck.ARCHIVE_PUBLIC_DEPLOY)) return true;
  return String(envToCheck.NODE_ENV || "").toLowerCase() === "production";
}

interface SecretCheckResult {
  required: boolean;
  missing: string[];
}

export function assertProductionSecrets(
  env?: NodeJS.ProcessEnv
): SecretCheckResult {
  const envToCheck = env ?? process.env;
  if (!isPublicProduction(envToCheck))
    return { required: false, missing: [] };

  const hasAuthSecret = Boolean(
    String(envToCheck.JWT_AUTH_SECRET || "").trim()
  );
  const hasShareSecret = Boolean(
    String(envToCheck.JWT_SHARE_SECRET || "").trim()
  );
  const hasOauthSecret = Boolean(
    String(envToCheck.OAUTH_STATE_SECRET || "").trim()
  );
  const hasLegacySecret = Boolean(String(envToCheck.JWT_SECRET || "").trim());

  const missing: string[] = [];

  // Hard failure: no usable JWT secret at all.
  if (!hasLegacySecret && !hasAuthSecret)
    missing.push("JWT_SECRET (or JWT_AUTH_SECRET)");
  if (!String(envToCheck.ADMIN_PASSWORD || "").trim())
    missing.push("ADMIN_PASSWORD");

  if (missing.length) {
    throw new Error(
      `Production deployment is missing required secret(s): ${missing.join(", ")}. ` +
        "Set them in .env or disable public deployment only for local testing with ARCHIVE_PUBLIC_DEPLOY=0."
    );
  }

  // Advisory warning: legacy single-secret still in use.
  if (
    hasLegacySecret &&
    !hasAuthSecret &&
    !hasShareSecret &&
    !hasOauthSecret
  ) {
    log.warn(
      "JWT_SECRET is being used for all token types. " +
        "For better security in production, set separate secrets: " +
        "JWT_AUTH_SECRET, JWT_SHARE_SECRET, and OAUTH_STATE_SECRET. " +
        "JWT_SECRET will continue to work as a fallback."
    );
  }

  // Advisory warning: missing APP_BASE_URL.
  // Without it, password-reset links are built from the incoming Host header,
  // which is attacker-controlled and enables open-redirect phishing.
  if (!String(envToCheck.APP_BASE_URL || "").trim()) {
    log.warn(
      "APP_BASE_URL is not set. Password-reset links will be derived from the " +
        "incoming request Host header, which can be spoofed. " +
        "Set APP_BASE_URL=https://your-domain.example.com in .env."
    );
  }

  return { required: true, missing: [] };
}
