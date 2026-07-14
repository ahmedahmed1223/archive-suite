import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);

export function verifyBundle(inputDir, { log = (message) => process.stdout.write(message) } = {}) {
  const dir = resolve(inputDir);
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const inventory = JSON.parse(readFileSync(join(dir, "images.v1.json"), "utf8"));
  const expectedFiles = new Set([...manifest.files.map(({ path }) => path), "manifest.json", "SHA256SUMS"]);
  const actualFiles = walk(dir).map((path) => relative(dir, path).replaceAll("\\", "/"));
  for (const path of actualFiles) if (!expectedFiles.has(path)) throw new Error(`unexpected file outside manifest: ${path}`);
  for (const path of expectedFiles) if (!actualFiles.includes(path)) throw new Error(`manifest file missing: ${path}`);

  const fileByPath = new Map();
  for (const file of manifest.files) {
    if (fileByPath.has(file.path)) throw new Error(`duplicate manifest path: ${file.path}`);
    const path = join(dir, file.path);
    if (!existsSync(path) || statSync(path).size !== file.bytes || sha256(path) !== file.sha256) throw new Error(`bundle verification failed: ${file.path}`);
    fileByPath.set(file.path, file);
  }
  const expectedIds = inventory.images.map(({ id }) => id);
  if (manifest.images.map(({ id }) => id).join("\n") !== expectedIds.join("\n")) throw new Error("bundle image IDs/order differ from inventory");
  const archives = new Set();
  for (const [index, image] of manifest.images.entries()) {
    const declared = inventory.images[index];
    const archive = `images/${image.id}.tar`;
    const expectedRef = declared.bundleRef.replace("$VERSION", manifest.version);
    if (image.archive !== archive || image.bundleRef !== expectedRef || image.kind !== declared.kind) throw new Error(`image metadata mismatch: ${image.id}`);
    if (archives.has(image.archive)) throw new Error(`duplicate image archive: ${image.archive}`);
    archives.add(image.archive);
    const file = fileByPath.get(image.archive);
    if (!file || image.sha256 !== file.sha256 || image.sha256 !== sha256(join(dir, image.archive))) throw new Error(`image checksum mismatch: ${image.id}`);
  }
  const tarFiles = actualFiles.filter((path) => /^images\/[^/]+\.tar$/.test(path));
  if (tarFiles.length !== archives.size || tarFiles.some((path) => !archives.has(path))) throw new Error("image archives are not one-to-one with inventory");
  log(`Verified ${manifest.files.length} files and ${manifest.images.length} images (closed world).\n`);
}

if (process.argv[1] && basename(process.argv[1]) === "verify-bundle.mjs") verifyBundle(process.argv[2] ?? ".");
