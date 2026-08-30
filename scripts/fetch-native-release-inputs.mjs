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
    redisUrl: env.REDIS_URL,
    redisSha256: env.REDIS_SHA256,
  };
  if (!validHttps(values.postgresUrl) || !validHttps(values.pgvectorUrl)
      || !validHttps(values.redisUrl)
      || !SHA256.test(values.postgresSha256 || "") || !SHA256.test(values.pgvectorSha256 || "")
      || !SHA256.test(values.redisSha256 || "")) {
    throw new Error("Windows Native release inputs require three HTTPS sources and exact SHA-256 values.");
  }
  return values;
}

export function validateLinuxReleaseInputEnvironment(env) {
  const values = {
    postgresUrl: env.POSTGRES_URL,
    postgresSha256: env.POSTGRES_SHA256,
    pgvectorUrl: env.PGVECTOR_URL,
    pgvectorSha256: env.PGVECTOR_SHA256,
    redisUrl: env.REDIS_URL,
    redisSha256: env.REDIS_SHA256,
  };
  if (!validHttps(values.postgresUrl) || !validHttps(values.pgvectorUrl)
      || !validHttps(values.redisUrl)
      || !SHA256.test(values.postgresSha256 || "") || !SHA256.test(values.pgvectorSha256 || "")
      || !SHA256.test(values.redisSha256 || "")) {
    throw new Error("Linux Native release inputs require three HTTPS sources and exact SHA-256 values.");
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
  return defaultExtractArchive({ archive, destination, format: "zip", label: "pgvector" });
}

function defaultExtractArchive({ archive, destination, format, label }) {
  mkdirSync(destination, { recursive: true });
  const listing = format === "zip" && process.platform !== "win32"
    ? spawnSync("unzip", ["-Z1", archive], { encoding: "utf8", shell: false })
    : spawnSync("tar", ["-tzf", archive], { encoding: "utf8", shell: false });
  if (listing.status !== 0) throw new Error(`${label} archive listing failed with exit code ${listing.status}.`);
  for (const entry of String(listing.stdout || "").split(/\r?\n/).filter(Boolean)) {
    const normalized = entry.replaceAll("\\", "/");
    if (normalized === "." || normalized === "./") continue;
    const path = normalized.replace(/^\.\//, "").replace(/\/+$/, "");
    if (!path || normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized)
        || path.split("/").some((segment) => segment === ".." || segment === "")) {
      throw new Error(`${label} archive contains an unsafe path: ${entry}`);
    }
  }
  const command = format === "zip" && process.platform !== "win32" ? "unzip" : "tar";
  const args = command === "unzip" ? ["-q", archive, "-d", destination] : ["--no-same-owner", "--no-same-permissions", "-xf", archive, "-C", destination];
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error(`${label} archive extraction failed with exit code ${result.status}.`);
}

function archiveFormat(url, fallback = "tar.gz") {
  const pathname = new URL(url).pathname.toLowerCase();
  return pathname.endsWith(".zip") ? "zip" : fallback;
}

async function fetchAndExtract({ input, urlKey, shaKey, outDir, name, format, fetchBytes, extractArchive }) {
  const archive = join(outDir, `${name}.${format === "zip" ? "zip" : "tar.gz"}`);
  const destination = join(outDir, name);
  const bytes = await fetchBytes(input[urlKey]);
  verify(bytes, input[shaKey], `${name} archive`);
  writeFileSync(archive, bytes);
  await extractArchive({ archive, destination, format, label: name });
  return destination;
}

export async function fetchWindowsReleaseInputs({
  outDir,
  env = process.env,
  fetchBytes = defaultFetchBytes,
  extractPgvector = defaultExtractPgvector,
  extractArchive = defaultExtractArchive,
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
  const redisDirectory = await fetchAndExtract({
    input,
    urlKey: "redisUrl",
    shaKey: "redisSha256",
    outDir: root,
    name: "redis",
    format: archiveFormat(input.redisUrl, "zip"),
    fetchBytes,
    extractArchive,
  });
  return { postgresInstaller, pgvectorDirectory, redisDirectory };
}

export async function fetchLinuxReleaseInputs({
  outDir,
  env = process.env,
  fetchBytes = defaultFetchBytes,
  extractArchive = defaultExtractArchive,
} = {}) {
  if (!outDir) throw new Error("Linux Native release input output directory is required.");
  const input = validateLinuxReleaseInputEnvironment(env);
  const root = resolve(outDir);
  mkdirSync(root, { recursive: true });
  const directories = {};
  for (const name of ["postgres", "pgvector", "redis"]) {
    directories[name] = await fetchAndExtract({
      input,
      urlKey: `${name === "postgres" ? "postgres" : name}Url`,
      shaKey: `${name === "postgres" ? "postgres" : name}Sha256`,
      outDir: root,
      name,
      format: archiveFormat(input[`${name === "postgres" ? "postgres" : name}Url`]),
      fetchBytes,
      extractArchive,
    });
  }
  return directories;
}

async function main(argv) {
  const [platform, ...args] = argv;
  const outIndex = args.indexOf("--out");
  const inline = args.find((value) => value.startsWith("--out="));
  const outDir = inline?.slice("--out=".length) || (outIndex >= 0 ? args[outIndex + 1] : null);
  if (!["windows", "linux"].includes(platform) || !outDir) throw new Error("Usage: node scripts/fetch-native-release-inputs.mjs <windows|linux> --out <directory>");
  const result = platform === "windows"
    ? await fetchWindowsReleaseInputs({ outDir })
    : await fetchLinuxReleaseInputs({ outDir });
  console.log(JSON.stringify({ ok: true, platform, ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
