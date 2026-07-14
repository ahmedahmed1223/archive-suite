import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const SECRET_KEYS = /(SECRET|PASSWORD|TOKEN|KEY|DSN|URL)$/;
const PLACEHOLDER_VALUES = new Set(["archive-collab", "archive-collab-key", "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="]);

function parseEnvValue(value) {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("#")) return "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
  return raw.replace(/\s+#.*$/, "").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setVar(content, key, value) {
  const re = new RegExp(`^(${escapeRegExp(key)}=).*`, "gm");
  return re.test(content)
    ? content.replace(re, (_line, prefix) => `${prefix}${value}`)
    : `${content.replace(/\n?$/, "\n")}${key}=${value}`;
}

export function createConfiguration({ envPath, output }) {
  const readEnvRaw = () => (existsSync(envPath) ? readFileSync(envPath, "utf8") : "");
  const readEnv = () => Object.fromEntries(
    readEnvRaw().split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, parseEnvValue(value)])
  );
  const writeEnv = (updates) => {
    if (!existsSync(envPath)) { output.err(`No .env at ${envPath} — run Deploy first.`); return false; }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(envPath, `${envPath}.bak-${stamp}`);
    let content = readEnvRaw();
    for (const [key, value] of Object.entries(updates)) content = setVar(content, key, value);
    writeFileSync(envPath, content);
    output.ok(`Updated ${Object.keys(updates).join(", ")} (backup: .env.bak-${stamp})`);
    output.warn("Restart the stack for changes to take effect (menu: Server: restart).");
    return true;
  };
  return {
    envPath,
    readEnvRaw,
    readEnv,
    writeEnv,
    maskValue: (key, value) => (SECRET_KEYS.test(key) && value ? `${value.slice(0, 3)}...(hidden)` : value),
    genSecret: (bytes = 32) => randomBytes(bytes).toString("hex"),
    genPassword: (length = 24) => randomBytes(length).toString("base64url").slice(0, length),
    isPlaceholder: (value) => !value || value.includes("CHANGE_ME") || PLACEHOLDER_VALUES.has(value),
  };
}

export function validateAdminPassword(password) {
  return String(password || "").length < 12 ? "Password must be at least 12 characters." : null;
}
