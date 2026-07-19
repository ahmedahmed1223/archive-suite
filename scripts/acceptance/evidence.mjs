import { mkdirSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

import { sanitize, secureBundleFile } from "../observability.mjs";
import { validateResult } from "./contracts.mjs";

const LEAK_PATTERNS = [
  /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+(?!\[REDACTED\])\S+/i,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@:'"]+:(?!\[REDACTED\])[^\s/@'"]+@/i,
  /(["']?)(password|passwd|secret|token|access_token|client_secret|api[_-]?key|app_key|private_key|dsn)\1\s*[:=]\s*(?!"?\[REDACTED\]"?)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;&}]+)/i,
  /(?:[A-Za-z]:\\Users\\|\/home\/|\/Users\/)(?!\[REDACTED)[^\s"']+/i,
];

export function assertNoSensitiveEvidence(value) {
  const text = String(value ?? "");
  if (LEAK_PATTERNS.some((pattern) => pattern.test(text))) throw new Error("sensitive evidence detected");
  return text;
}

export function createEvidenceStore({ root, runId, now = new Date(), secure = secureBundleFile }) {
  const directory = join(root, runId);

  function writeArtifact(name, data) {
    if (!name || name.includes("..") || name.includes("/") || name.includes(sep)) {
      throw new Error("artifact name must not escape the run directory");
    }
    const encoded = JSON.stringify(sanitize(data), null, 2);
    assertNoSensitiveEvidence(encoded);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, name);
    writeFileSync(path, encoded, { encoding: "utf8", mode: 0o600, flag: "wx" });
    secure(path);
    return path;
  }

  function finalize({ status, results }) {
    const manifest = {
      schemaVersion: 1,
      runId,
      generatedAt: now.toISOString(),
      status,
      results: results.map((result) => validateResult(result)),
    };
    writeArtifact("manifest.json", manifest);
    return manifest;
  }

  return { directory, writeArtifact, finalize };
}
