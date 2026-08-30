import { randomBytes as defaultRandomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: "utf8", ...options });
}

function statusOk(outcome) {
  return outcome === undefined || outcome?.status === 0;
}

function parseSecrets(content) {
  const values = {};
  for (const line of String(content).split(/\r?\n/)) {
    const match = line.match(/^(APP_KEY|ARCHIVE_DB_OWNER_PASSWORD|ARCHIVE_DB_APP_PASSWORD|ARCHIVE_REDIS_PASSWORD)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  const secrets = {
    appKey: values.APP_KEY,
    dbOwnerPassword: values.ARCHIVE_DB_OWNER_PASSWORD,
    dbAppPassword: values.ARCHIVE_DB_APP_PASSWORD,
    redisPassword: values.ARCHIVE_REDIS_PASSWORD,
  };
  if (Object.values(secrets).some((value) => typeof value !== "string" || !value || /[\r\n]/.test(value))) {
    throw new Error("Native secret store contains incomplete or unsafe values.");
  }
  return secrets;
}

export function createNativeSecretStore({ platform, installRoot, randomBytes = defaultRandomBytes, writeFile = defaultWriteFile, protect = () => ({ status: 0 }), exists = existsSync, readFile = readFileSync } = {}) {
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
    load() {
      if (!exists(path)) throw new Error("Native secret store does not exist.");
      return parseSecrets(readFile(path, "utf8"));
    },
    ensure() {
      try { return this.load(); }
      catch (error) {
        if (error?.message !== "Native secret store does not exist.") throw error;
        return this.create();
      }
    },
    manifestReference() {
      return { path };
    },
  };
}
