import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SENSITIVE_KEY = /(password|secret|token|credential|authorization|cookie|dsn|connection|key)/i;
const CREDENTIAL_URL = /^[a-z][a-z\d+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;
const PLATFORM_IDS = new Set(["windows-native", "linux-native"]);

function assertSafe(value, field = "evidence") {
  if (typeof value === "string") {
    if (CREDENTIAL_URL.test(value)) throw new Error(`${field} contains a credential URL.`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafe(item, `${field}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error(`${field}.${key} is a sensitive evidence field.`);
    assertSafe(child, `${field}.${key}`);
  }
}

export function writeAcceptanceEvidence(input, { outputDir }) {
  if (!PLATFORM_IDS.has(input?.platform)) throw new Error("Evidence requires a Native platform id.");
  if (input?.cleanup?.ok !== true) throw new Error("Acceptance evidence requires proven cleanup.");
  if (!Array.isArray(input.scenarios) || input.scenarios.some(({ ok }) => ok !== true)) throw new Error("Acceptance evidence requires every scenario to pass.");
  const evidence = {
    schemaVersion: "1.0",
    platform: input.platform,
    runId: input.runId,
    commit: input.commit,
    version: input.version,
    bundleDigest: input.bundleDigest,
    environment: input.environment,
    scenarios: input.scenarios,
    cleanup: input.cleanup,
    createdAt: input.createdAt,
  };
  assertSafe(evidence);
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, "final-manifest.json");
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return path;
}
