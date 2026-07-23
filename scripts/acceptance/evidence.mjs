import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { sanitize, secureBundleFile } from "../observability.mjs";
import { validateResult } from "./contracts.mjs";

const LEAK_PATTERNS = [
  /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+(?!\[REDACTED\])\S+/i,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/@:'"]+:(?!\[REDACTED\])[^\s/@'"]+@/i,
  /(["']?)(password|passwd|secret|token|access_token|client_secret|api[_-]?key|app_key|private_key|dsn)\1\s*[:=]\s*(?!"?\[REDACTED\]"?)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;&}]+)/i,
  /(?:[A-Za-z]:\\Users\\|\/home\/|\/Users\/)(?!\[REDACTED)[^\s"']+/i,
];

function isInside(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !path.includes(":"));
}

function secureEvidenceDirectory(path) {
  if (process.platform === "win32") {
    const owner = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : process.env.USERNAME;
    if (!owner) throw new Error("Cannot determine Windows evidence owner");
    const applied = spawnSync("icacls", [path, "/inheritance:r", "/grant:r", `${owner}:(OI)(CI)(F)`], { encoding: "utf8", windowsHide: true });
    if (applied.status !== 0) throw new Error("Failed to apply owner-only Windows evidence ACL");
    const verified = spawnSync("icacls", [path], { encoding: "utf8", windowsHide: true });
    const acl = String(verified.stdout || "");
    if (verified.status !== 0 || !acl.toLowerCase().includes(owner.toLowerCase()) || /everyone|authenticated users|builtin\\users/i.test(acl)) {
      throw new Error("Failed to verify owner-only Windows evidence ACL");
    }
    return;
  }
  chmodSync(path, 0o700);
  if ((statSync(path).mode & 0o777) !== 0o700) throw new Error("Evidence directory permissions are not 0700");
}

function scanDirectory(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const artifact = join(path, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(artifact);
    } else if (entry.isFile()) {
      assertNoSensitiveEvidence(readFileSync(artifact));
    }
  }
}

export function assertNoSensitiveEvidence(value) {
  const text = String(value ?? "");
  if (LEAK_PATTERNS.some((pattern) => pattern.test(text))) throw new Error("sensitive evidence detected");
  return text;
}

export function createEvidenceStore({ root, runId, sourceRoot = process.cwd(), now = new Date(), secure = secureBundleFile, secureDirectory = secureEvidenceDirectory }) {
  const evidenceRoot = resolve(root);
  if (isInside(resolve(sourceRoot), evidenceRoot)) throw new Error("evidence root must be outside the source tree");
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(runId)) throw new Error("run id is invalid");
  const directory = join(evidenceRoot, runId);

  function ensureDirectory() {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    secureDirectory(directory);
  }

  function writeArtifact(name, data) {
    if (!name || name.includes("..") || name.includes("/") || name.includes(sep)) {
      throw new Error("artifact name must not escape the run directory");
    }
    const encoded = JSON.stringify(sanitize(data), null, 2);
    assertNoSensitiveEvidence(encoded);
    ensureDirectory();
    const path = join(directory, name);
    writeFileSync(path, encoded, { encoding: "utf8", mode: 0o600, flag: "wx" });
    secure(path);
    return path;
  }

  function finalize({ status, results, ...summary }) {
    const manifest = {
      ...sanitize(summary),
      schemaVersion: 1,
      runId,
      generatedAt: now.toISOString(),
      status,
      results: results.map((result) => validateResult(result)),
    };
    ensureDirectory();
    scanDirectory(directory);
    writeArtifact("summary.json", manifest);
    writeArtifact("manifest.json", manifest);
    scanDirectory(directory);
    return manifest;
  }

  return { directory, writeArtifact, finalize };
}
