import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/i;

function validHttps(value) {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

export function validateWindowsReleaseInputEnvironment(env) {
  const values = {
    postgresUrl: env.POSTGRES_URL,
    postgresSha256: env.POSTGRES_SHA256,
    pgvectorUrl: env.PGVECTOR_URL,
    pgvectorSha256: env.PGVECTOR_SHA256,
  };
  if (!validHttps(values.postgresUrl) || !validHttps(values.pgvectorUrl)
      || !SHA256.test(values.postgresSha256 || "") || !SHA256.test(values.pgvectorSha256 || "")) {
    throw new Error("Windows Native release inputs require HTTPS sources and exact SHA-256 values.");
  }
  return values;
}

async function defaultFetchBytes(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to download Native release input: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function verify(bytes, expected, label) {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected.toLowerCase()) throw new Error(`${label} checksum mismatch: expected ${expected}, got ${actual}`);
}

function defaultExtractPgvector({ archive, destination }) {
  mkdirSync(destination, { recursive: true });
  // The release input is a ZIP archive. GNU tar on ubuntu-latest does not
  // support ZIP, even though Windows bsdtar often does, so use the format's
  // canonical extractor on the Linux build runner.
  const result = spawnSync("unzip", ["-q", archive, "-d", destination], { stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error(`pgvector archive extraction failed with exit code ${result.status}.`);
}

export async function fetchWindowsReleaseInputs({
  outDir,
  env = process.env,
  fetchBytes = defaultFetchBytes,
  extractPgvector = defaultExtractPgvector,
} = {}) {
  if (!outDir) throw new Error("Windows Native release input output directory is required.");
  const input = validateWindowsReleaseInputEnvironment(env);
  const root = resolve(outDir);
  const postgresInstaller = join(root, "postgresql-installer.exe");
  const pgvectorArchive = join(root, "pgvector.zip");
  const pgvectorDirectory = join(root, "pgvector");
  mkdirSync(root, { recursive: true });

  const postgresBytes = await fetchBytes(input.postgresUrl);
  verify(postgresBytes, input.postgresSha256, "PostgreSQL installer");
  writeFileSync(postgresInstaller, postgresBytes);

  const pgvectorBytes = await fetchBytes(input.pgvectorUrl);
  verify(pgvectorBytes, input.pgvectorSha256, "pgvector archive");
  writeFileSync(pgvectorArchive, pgvectorBytes);
  await extractPgvector({ archive: pgvectorArchive, destination: pgvectorDirectory });
  return { postgresInstaller, pgvectorDirectory };
}

async function main(argv) {
  const [platform, ...args] = argv;
  const outIndex = args.indexOf("--out");
  const inline = args.find((value) => value.startsWith("--out="));
  const outDir = inline?.slice("--out=".length) || (outIndex >= 0 ? args[outIndex + 1] : null);
  if (platform !== "windows" || !outDir) throw new Error("Usage: node scripts/fetch-native-release-inputs.mjs windows --out <directory>");
  const result = await fetchWindowsReleaseInputs({ outDir });
  console.log(JSON.stringify({ ok: true, platform, ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
