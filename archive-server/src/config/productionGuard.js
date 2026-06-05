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

  const missing = [];
  if (!String(env.JWT_SECRET || "").trim()) missing.push("JWT_SECRET");
  if (!String(env.ADMIN_PASSWORD || "").trim()) missing.push("ADMIN_PASSWORD");

  if (missing.length) {
    throw new Error(
      `Production deployment is missing required secret(s): ${missing.join(", ")}. ` +
      "Set them in .env or disable public deployment only for local testing with ARCHIVE_PUBLIC_DEPLOY=0."
    );
  }

  return { required: true, missing: [] };
}
