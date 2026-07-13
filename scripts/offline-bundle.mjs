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

function build(version, output) {
  const dir = join(output, `archive-suite-offline-${version}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "images"), { recursive: true });
  for (const name of ["compose.v1.yml", "generate-env.mjs", "verify-bundle.mjs", "images.v1.json", "install.sh", "install.ps1", "README.ar.md"]) cpSync(join(root, "infra/offline", name), join(dir, name));
  cpSync(join(root, "infra/deploy/Caddyfile"), join(dir, "Caddyfile"));
  writeFileSync(join(dir, "VERSION"), `${version}\n`);
  const images = inventory.images.map((image) => {
    const source = image.source ?? process.env[image.sourceEnv];
    if (!source) throw new Error(`Set ${image.sourceEnv} to the signed, verified image@digest`);
    if (image.kind === "application" && !/@sha256:[a-f0-9]{64}$/.test(source)) throw new Error(`${image.sourceEnv} must be immutable image@sha256:digest`);
    const bundleRef = image.bundleRef.replace("$VERSION", version);
    if (image.kind === "runtime") run("docker", ["pull", source]);
    else run("docker", ["image", "inspect", source], { capture: true });
    run("docker", ["tag", source, bundleRef]);
    const archive = join(dir, "images", `${image.id}.tar`);
    run("docker", ["save", "--output", archive, bundleRef]);
    return { id: image.id, kind: image.kind, source, bundleRef, archive: `images/${image.id}.tar`, sha256: sha256(archive) };
  });
  const payload = files(dir).filter((path) => basename(path) !== "manifest.json" && basename(path) !== "SHA256SUMS");
  const manifest = {
    schemaVersion: 1,
    version,
    profile: "core",
    createdAt: new Date().toISOString(),
    images,
    files: payload.map((path) => ({ path: relative(dir, path).replaceAll("\\", "/"), bytes: statSync(path).size, sha256: sha256(path) })),
  };
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const checked = [...manifest.files, { path: "manifest.json", sha256: sha256(join(dir, "manifest.json")) }];
  writeFileSync(join(dir, "SHA256SUMS"), checked.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n");
  verifyBundle(dir);
  const archiveName = `${basename(dir)}.tar.gz`;
  run("tar", ["-czf", join(output, archiveName), "-C", output, basename(dir)]);
  process.stdout.write(`${join(output, archiveName)}\n`);
}

function rehearsal(dir, evidencePath) {
  verifyBundle(dir);
  const project = `archive-suite-v1-206-${Date.now()}`;
  const env = join(dir, ".env.rehearsal");
  const version = readFileSync(join(dir, "VERSION"), "utf8").trim();
  const httpPort = String(18000 + (Date.now() % 1000));
  const httpsPort = String(19000 + (Date.now() % 1000));
  const compose = ["compose", "--project-name", project, "--env-file", env, "-f", join(dir, "compose.v1.yml")];
  const evidence = { schemaVersion: 1, project, version, startedAt: new Date().toISOString(), pullPolicy: "never", buildDirectives: 0, loadedImages: [], healthy: false, https: false, cleanup: false };
  rmSync(env, { force: true });
  try {
    run(process.execPath, [join(dir, "generate-env.mjs"), env], { env: { ...process.env, ARCHIVE_VERSION: version } });
    for (const image of inventory.images) {
      run("docker", ["image", "load", "--input", join(dir, "images", `${image.id}.tar`)], { stdio: "ignore" });
      evidence.loadedImages.push(image.id);
    }
    const childEnv = { ...process.env, HTTP_PORT: httpPort, HTTPS_PORT: httpsPort };
    run("docker", [...compose, "config", "--quiet"], { env: childEnv });
    run("docker", [...compose, "up", "-d", "--wait", "--wait-timeout", "240"], { env: childEnv });
    evidence.healthy = true;
    run("curl", ["--fail", "--silent", "--show-error", "--insecure", `https://localhost:${httpsPort}/`], { stdio: "ignore" });
    evidence.https = true;
  } finally {
    run("docker", [...compose, "down", "--volumes", "--remove-orphans"], { env: { ...process.env, HTTP_PORT: httpPort, HTTPS_PORT: httpsPort } });
    const containers = run("docker", ["ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--quiet"], { capture: true });
    const volumes = run("docker", ["volume", "ls", "--filter", `label=com.docker.compose.project=${project}`, "--quiet"], { capture: true });
    if (containers || volumes) throw new Error(`scoped rehearsal resources remain for ${project}`);
    evidence.cleanup = true;
    evidence.finishedAt = new Date().toISOString();
    rmSync(env, { force: true });
    if (evidencePath) writeFileSync(resolve(evidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  process.stdout.write(`Offline rehearsal passed: ${project}; local load, healthy stack, HTTPS, scoped cleanup.\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("offline-bundle.mjs")) {
  const [command, arg, out = join(root, "output/offline")] = process.argv.slice(2);
  if (command === "build") build(normalizedVersion(arg), resolve(out));
  else if (command === "verify") verifyBundle(resolve(arg));
  else if (command === "rehearse") rehearsal(resolve(arg), out === join(root, "output/offline") ? undefined : out);
  else throw new Error("Usage: node scripts/offline-bundle.mjs build <version> [output] | verify <bundle-dir> | rehearse <bundle-dir>");
}
