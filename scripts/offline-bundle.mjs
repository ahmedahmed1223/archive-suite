import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

export function verifyBundle(dir) {
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const file of manifest.files) {
    const path = join(dir, file.path);
    if (!existsSync(path) || statSync(path).size !== file.bytes || sha256(path) !== file.sha256) throw new Error(`bundle verification failed: ${file.path}`);
  }
  if (manifest.images.length !== inventory.images.length) throw new Error("bundle image inventory is incomplete");
  process.stdout.write(`Verified ${manifest.files.length} files and ${manifest.images.length} images.\n`);
}

function build(version, output) {
  const dir = join(output, `archive-suite-offline-${version}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "images"), { recursive: true });
  for (const name of ["compose.v1.yml", "generate-env.mjs", "install.sh", "install.ps1", "README.ar.md"]) cpSync(join(root, "infra/offline", name), join(dir, name));
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

function rehearsal(dir) {
  verifyBundle(dir);
  const project = `archive-suite-v1-206-${Date.now()}`;
  const env = join(dir, ".env.rehearsal");
  const version = readFileSync(join(dir, "VERSION"), "utf8").trim();
  rmSync(env, { force: true });
  run(process.execPath, [join(dir, "generate-env.mjs"), env], { env: { ...process.env, ARCHIVE_VERSION: version } });
  for (const image of inventory.images) run("docker", ["image", "load", "--input", join(dir, "images", `${image.id}.tar`)], { stdio: "ignore" });
  run("docker", ["compose", "--project-name", project, "--env-file", env, "-f", join(dir, "compose.v1.yml"), "config", "--quiet"]);
  rmSync(env, { force: true });
  process.stdout.write(`Offline rehearsal passed with isolated project ${project}; no containers were started.\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("offline-bundle.mjs")) {
  const [command, arg, out = join(root, "output/offline")] = process.argv.slice(2);
  if (command === "build") build(normalizedVersion(arg), resolve(out));
  else if (command === "verify") verifyBundle(resolve(arg));
  else if (command === "rehearse") rehearsal(resolve(arg));
  else throw new Error("Usage: node scripts/offline-bundle.mjs build <version> [output] | verify <bundle-dir> | rehearse <bundle-dir>");
}
