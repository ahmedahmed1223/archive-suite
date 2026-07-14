import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { verifyBundle } from "../infra/offline/verify-bundle.mjs";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)));
const inventory = JSON.parse(readFileSync(join(root, "infra/offline/images.v1.json"), "utf8"));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  return result.stdout?.trim();
};
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const normalizedVersion = (value) => {
  if (!/^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(value ?? "")) throw new Error("version must be semver, for example v1.0.0-rc.1");
  return value;
};

export function resolveReleaseInventory(version, environment = process.env, baseInventory = inventory) {
  normalizedVersion(version);
  const required = { postgres: "POSTGRES_IMAGE", redis: "REDIS_IMAGE", next: "NEXT_IMAGE", laravel: "LARAVEL_IMAGE", "laravel-fpm": "LARAVEL_IMAGE", "laravel-worker": "LARAVEL_IMAGE", "laravel-reverb": "LARAVEL_IMAGE" };
  return baseInventory.images.map((image) => {
    const supplied = required[image.id] ? environment[required[image.id]] : (environment[`${image.id.toUpperCase().replaceAll("-", "_")}_IMAGE`] || image.source);
    // Git tags are conventionally vX.Y.Z while release descriptors use X.Y.Z.
    // Normalize only that tag position; the registry/name/digest stay intact.
    const source = supplied?.replace(/:v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)@sha256:/, ":$1@sha256:");
    if (!source || !/@sha256:[a-f0-9]{64}$/.test(source)) throw new Error(`Set ${required[image.id] || `${image.id.toUpperCase().replaceAll("-", "_")}_IMAGE`} to the signature-verified immutable image@sha256 digest`);
    // Application images from CI are verified before this command and may be
    // digest-only refs; their released semantic version is carried by VERSION.
    return { ...image, source };
  });
}

export function build(version, output, { runCommand = run } = {}) {
  const canonicalVersion = normalizedVersion(version).replace(/^v/, "");
  const resolvedInventory = resolveReleaseInventory(version);
  const dir = join(output, `archive-suite-offline-${version}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "images"), { recursive: true });
  for (const name of ["compose.v1.yml", "generate-env.mjs", "verify-bundle.mjs", "install.sh", "install.ps1", "README.ar.md"]) cpSync(join(root, "infra/offline", name), join(dir, name));
  writeFileSync(join(dir, "images.v1.json"), `${JSON.stringify({ ...inventory, images: resolvedInventory }, null, 2)}\n`);
  cpSync(join(root, "infra/deploy/Caddyfile"), join(dir, "Caddyfile"));
  writeFileSync(join(dir, "VERSION"), `${canonicalVersion}\n`);
  const images = resolvedInventory.map((image) => {
    const source = image.source;
    if (!source || !/@sha256:[a-f0-9]{64}$/.test(source)) throw new Error(`offline inventory image ${image.id} must be a signed immutable image@sha256 reference`);
    const bundleRef = image.bundleRef.replace("$VERSION", canonicalVersion);
    runCommand("docker", ["pull", source]);
    runCommand("docker", ["tag", source, bundleRef]);
    const archive = join(dir, "images", `${image.id}.tar`);
    runCommand("docker", ["save", "--output", archive, bundleRef]);
    return { id: image.id, kind: image.kind, source, bundleRef, archive: `images/${image.id}.tar`, sha256: sha256(archive) };
  });
  const payload = files(dir).filter((path) => basename(path) !== "manifest.json" && basename(path) !== "SHA256SUMS");
  const manifest = {
    schemaVersion: 1,
    version,
    profile: "core",
    createdAt: new Date().toISOString(),
    sourceCommit: runCommand("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { capture: true }),
    images,
    files: payload.map((path) => ({ path: relative(dir, path).replaceAll("\\", "/"), bytes: statSync(path).size, sha256: sha256(path) })),
  };
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const checked = [...manifest.files, { path: "manifest.json", sha256: sha256(join(dir, "manifest.json")) }];
  writeFileSync(join(dir, "SHA256SUMS"), checked.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n");
  verifyBundle(dir);
  const archiveName = `${basename(dir)}.tar.gz`;
  runCommand("tar", ["-czf", join(output, archiveName), "-C", output, basename(dir)]);
  process.stdout.write(`${join(output, archiveName)}\n`);
}

export function cleanupRehearsal({ project, compose, envPath, childEnv = process.env, runCommand = run }) {
  const errors = [];
  const absence = { containers: false, volumes: false, networks: false };
  try {
    try { runCommand("docker", [...compose, "down", "--volumes", "--remove-orphans"], { env: childEnv }); }
    catch (error) { errors.push(error); }
    for (const [resource, args] of [
      ["containers", ["ps", "-a"]],
      ["volumes", ["volume", "ls"]],
      ["networks", ["network", "ls"]],
    ]) {
      try {
        const remaining = runCommand("docker", [...args, "--filter", `label=com.docker.compose.project=${project}`, "--quiet"], { capture: true });
        absence[resource] = !remaining;
        if (remaining) errors.push(new Error(`scoped rehearsal ${resource} remain for ${project}`));
      } catch (error) { errors.push(error); }
    }
  } finally {
    try { rmSync(envPath, { force: true }); }
    catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, errors.map(({ message }) => message).join("; "));
  return absence;
}

function verifyEvidence(dir, evidencePath) {
  verifyBundle(dir);
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const evidence = JSON.parse(readFileSync(resolve(evidencePath), "utf8"));
  const archive = join(resolve(dir, ".."), `${basename(dir)}.tar.gz`);
  if (evidence.sourceCommit !== manifest.sourceCommit || evidence.manifestSha256 !== sha256(manifestPath) || evidence.archiveSha256 !== sha256(archive)) throw new Error("stale rehearsal evidence: artifact identity mismatch");
  if (evidence.fileCount !== 14 || evidence.fileCount !== manifest.files.length || evidence.imageCount !== 7 || evidence.imageCount !== manifest.images.length) throw new Error("stale rehearsal evidence: bundle counts mismatch");
  if (!evidence.http || !evidence.healthy || !evidence.cleanup || Object.values(evidence.cleanupAbsence).some((value) => value !== true)) throw new Error("rehearsal evidence does not prove core HTTP health/cleanup");
  process.stdout.write(`Verified rehearsal evidence for ${evidence.sourceCommit}.\n`);
}

function rehearsal(dir, evidencePath) {
  verifyBundle(dir);
  const project = `archive-suite-v1-206-${Date.now()}`;
  const env = join(dir, ".env.rehearsal");
  const version = readFileSync(join(dir, "VERSION"), "utf8").trim();
  const httpPort = String(18000 + (Date.now() % 1000));
  const compose = ["compose", "--project-name", project, "--env-file", env, "-f", join(dir, "compose.v1.yml")];
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const archivePath = join(resolve(dir, ".."), `${basename(dir)}.tar.gz`);
  const evidence = { schemaVersion: 1, project, version, sourceCommit: manifest.sourceCommit, manifestSha256: sha256(manifestPath), archiveSha256: null, fileCount: 14, imageCount: 7, startedAt: new Date().toISOString(), pullPolicy: "never", buildDirectives: 0, loadedImages: [], healthy: false, http: false, cleanup: false, cleanupAbsence: { containers: false, volumes: false, networks: false } };
  rmSync(env, { force: true });
  try {
    run(process.execPath, [join(dir, "generate-env.mjs"), env], { env: { ...process.env, ARCHIVE_VERSION: version } });
    for (const image of inventory.images) {
      run("docker", ["image", "load", "--input", join(dir, "images", `${image.id}.tar`)], { stdio: "ignore" });
      evidence.loadedImages.push(image.id);
    }
    const childEnv = { ...process.env, HTTP_PORT: httpPort };
    run("docker", [...compose, "config", "--quiet"], { env: childEnv });
    run("docker", [...compose, "up", "-d", "--wait", "--wait-timeout", "240"], { env: childEnv });
    evidence.healthy = true;
    run("curl", ["--fail", "--silent", "--show-error", `http://localhost:${httpPort}/`], { stdio: "ignore" });
    evidence.http = true;
  } finally {
    evidence.cleanupAbsence = cleanupRehearsal({ project, compose, envPath: env, childEnv: { ...process.env, HTTP_PORT: httpPort } });
    evidence.cleanup = true;
    evidence.archiveSha256 = sha256(archivePath);
    evidence.finishedAt = new Date().toISOString();
    if (evidencePath) writeFileSync(resolve(evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  process.stdout.write(`Offline core rehearsal passed: ${project}; local load, healthy stack, HTTP, scoped cleanup.\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("offline-bundle.mjs")) {
  const [command, arg, out = join(root, "output/offline")] = process.argv.slice(2);
  if (command === "build") build(normalizedVersion(arg), resolve(out));
  else if (command === "verify") verifyBundle(resolve(arg));
  else if (command === "rehearse") rehearsal(resolve(arg), out === join(root, "output/offline") ? undefined : out);
  else if (command === "verify-evidence") verifyEvidence(resolve(arg), out);
  else throw new Error("Usage: node scripts/offline-bundle.mjs build <version> [output] | verify <bundle-dir> | rehearse <bundle-dir>");
}
