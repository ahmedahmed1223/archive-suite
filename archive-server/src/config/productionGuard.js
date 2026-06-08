import { createLogger } from "../logger.js";

const log = createLogger("productionGuard");

function envFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function isDisabledFlag(value) {
  return ["0", "false", "no", "off"].includes(String(value || "").trim().toLowerCase());
}

export function isPublicProduction(env = process.env) {
  if (isDisabledFlag(env.ARCHIVE_PUBLIC_DEPLOY)) return false;
  if (envFlag(env.ARCHIVE_PUBLIC_DEPLOY)) return true;
  return String(env.NODE_ENV || "").toLowerCase() === "production";
}

export function assertProductionSecrets(env = process.env) {
  if (!isPublicProduction(env)) return { required: false, missing: [] };

  const hasAuthSecret   = Boolean(String(env.JWT_AUTH_SECRET    || "").trim());
  const hasShareSecret  = Boolean(String(env.JWT_SHARE_SECRET   || "").trim());
  const hasOauthSecret  = Boolean(String(env.OAUTH_STATE_SECRET || "").trim());
  const hasLegacySecret = Boolean(String(env.JWT_SECRET         || "").trim());

  const missing = [];

  // Hard failure: no usable JWT secret at all.
  if (!hasLegacySecret && !hasAuthSecret) missing.push("JWT_SECRET (or JWT_AUTH_SECRET)");
  if (!String(env.ADMIN_PASSWORD || "").trim()) missing.push("ADMIN_PASSWORD");

  if (missing.length) {
    throw new Error(
      `Production deployment is missing required secret(s): ${missing.join(", ")}. ` +
      "Set them in .env or disable public deployment only for local testing with ARCHIVE_PUBLIC_DEPLOY=0."
    );
  }

  // Advisory warning: legacy single-secret still in use.
  if (hasLegacySecret && !hasAuthSecret && !hasShareSecret && !hasOauthSecret) {
    log.warn(
      "JWT_SECRET is being used for all token types. " +
      "For better security in production, set separate secrets: " +
      "JWT_AUTH_SECRET, JWT_SHARE_SECRET, and OAUTH_STATE_SECRET. " +
      "JWT_SECRET will continue to work as a fallback."
    );
  }

  return { required: true, missing: [] };
}
