import { randomBytes as defaultRandomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { posix, win32 } from "node:path";

function requirePlatform(platform) {
  if (platform !== "windows-native" && platform !== "linux-native") throw new Error("Native secret store requires a Native platform.");
  return platform;
}

function requireInstallRoot(installRoot) {
  if (typeof installRoot !== "string" || !installRoot.trim()) throw new Error("Native secret store requires an install root.");
  return installRoot.trim();
}

function secretPath(platform, installRoot) {
  return platform === "windows-native"
    ? win32.join(installRoot, "config", "secrets.env")
    : posix.join(installRoot, "config", "secrets.env");
}

function defaultWriteFile(path, content, options) {
  writeFileSync(path, content, { encoding: "utf8", ...options });
}

function statusOk(outcome) {
  return outcome === undefined || outcome?.status === 0;
}

export function createNativeSecretStore({ platform, installRoot, randomBytes = defaultRandomBytes, writeFile = defaultWriteFile, protect = () => ({ status: 0 }) } = {}) {
  requirePlatform(platform);
  const root = requireInstallRoot(installRoot);
  const path = secretPath(platform, root);
  if (typeof randomBytes !== "function" || typeof writeFile !== "function" || typeof protect !== "function") throw new Error("Native secret store requires random bytes, file writing, and protection functions.");

  return {
    create() {
      const secrets = {
        appKey: `base64:${randomBytes(32).toString("base64")}`,
        dbOwnerPassword: randomBytes(32).toString("hex"),
        dbAppPassword: randomBytes(32).toString("hex"),
        redisPassword: randomBytes(32).toString("hex"),
      };
      writeFile(path, [
        `APP_KEY=${secrets.appKey}`,
        `ARCHIVE_DB_OWNER_PASSWORD=${secrets.dbOwnerPassword}`,
        `ARCHIVE_DB_APP_PASSWORD=${secrets.dbAppPassword}`,
        `ARCHIVE_REDIS_PASSWORD=${secrets.redisPassword}`,
        "",
      ].join("\n"), { mode: 0o600 });
      const protectedPath = protect(path, { platform });
      if (!statusOk(protectedPath)) throw new Error("Native secret protection could not be applied.");
      return secrets;
    },
    manifestReference() {
      return { path };
    },
  };
}
