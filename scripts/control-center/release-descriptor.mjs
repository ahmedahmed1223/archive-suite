import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyBundle } from "../../infra/offline/verify-bundle.mjs";

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const IMMUTABLE = /^[a-z0-9][a-z0-9./_-]*:[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?@sha256:[a-f0-9]{64}$/;
const REF = /^[a-z0-9][a-z0-9./_-]*:\$VERSION$/;
const PROFILES = new Set(["core", "media", "edge"]);
const CORE_SERVICES = new Set(["postgres", "redis", "laravel", "laravel-fpm", "laravel-worker", "laravel-reverb", "next"]);
const FORBIDDEN = /(password|secret|token|credential|authorization|cookie|dsn|connection|url|key)/i;
const DEFAULT_PATH = new URL("../../infra/platform/release.v1.json", import.meta.url);

export class ReleaseDescriptorError extends Error {
  constructor(code, message, nextActions = ["Correct the release descriptor and run setup repair."]) { super(message); this.code = code; this.nextActions = nextActions; }
}

function fail(code, message, nextActions) { throw new ReleaseDescriptorError(code, message, nextActions); }
function readJson(path) { try { return JSON.parse(readFileSync(path, "utf8")); } catch { fail("RELEASE_DESCRIPTOR_INVALID", "Release descriptor could not be read as valid JSON."); } }
function envName(id) { return `ARCHIVE_RELEASE_IMAGE_${id.replaceAll("-", "_").toUpperCase()}`; }
function checksum(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

export function loadReleaseDescriptor(path = DEFAULT_PATH) {
  const descriptor = readJson(path);
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor) || Object.keys(descriptor).length !== 3 || descriptor.schemaVersion !== "1.0" || !SEMVER.test(descriptor.version) || !Array.isArray(descriptor.images)) {
    fail("RELEASE_DESCRIPTOR_INVALID", "Release descriptor has an invalid closed schema or version.");
  }
  const ids = new Set(); const services = new Set();
  for (const image of descriptor.images) {
    if (!image || typeof image !== "object" || Object.keys(image).length !== 5 || Object.keys(image).some((key) => !["id", "service", "profile", "online", "offlineRef"].includes(key))) fail("RELEASE_DESCRIPTOR_INVALID", "Release descriptor image fields are invalid.");
    if ([image.id, image.service, image.profile, image.online, image.offlineRef].some((value) => typeof value !== "string" || !value.trim()) || FORBIDDEN.test(JSON.stringify(image))) fail("RELEASE_DESCRIPTOR_SENSITIVE", "Release descriptor must not contain credentials or secrets.");
    if (ids.has(image.id) || services.has(image.service)) fail("RELEASE_DESCRIPTOR_DUPLICATE", "Release descriptor cannot repeat an image or service.");
    if (!PROFILES.has(image.profile) || !IMMUTABLE.test(image.online) || !REF.test(image.offlineRef)) fail("RELEASE_DESCRIPTOR_INVALID", "Release descriptor image references must be immutable version+SHA-256 digests.");
    const version = image.online.match(/:([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)@/)[1];
    if (version !== descriptor.version) fail("RELEASE_VERSION_MISMATCH", "Every release image must match the descriptor semantic version.");
    ids.add(image.id); services.add(image.service);
  }
  for (const service of CORE_SERVICES) if (!services.has(service)) fail("RELEASE_CORE_IMAGES_MISSING", `Release descriptor is missing required core service "${service}".`);
  return descriptor;
}

function verifyOfflineBundle(bundlePath, descriptor, selected) {
  if (!bundlePath || !existsSync(bundlePath)) fail("OFFLINE_BUNDLE_REQUIRED", "Offline setup requires ARCHIVE_OFFLINE_BUNDLE_PATH with a verified bundle.", ["Provide the complete verified offline release bundle."]);
  try { verifyBundle(bundlePath, { log: () => {} }); } catch { fail("OFFLINE_BUNDLE_INVALID", "Offline bundle checksum or manifest verification failed.", ["Replace the bundle with a verified release package."]); }
  const manifest = readJson(join(bundlePath, "manifest.json"));
  if (manifest.version !== descriptor.version) fail("OFFLINE_VERSION_MISMATCH", "Offline bundle version does not match the selected release.");
  const byId = new Map(manifest.images.map((image) => [image.id, image]));
  for (const image of selected) {
    const reference = image.offlineRef.replace("$VERSION", descriptor.version);
    const bundleImage = byId.get(image.id) || manifest.images.find((candidate) => candidate.bundleRef === reference);
    if (!bundleImage || bundleImage.bundleRef !== reference || !/^[a-f0-9]{64}$/.test(bundleImage.sha256 || "")) fail("OFFLINE_IMAGE_MISMATCH", "Offline bundle images do not match the selected release/profile.");
    if (checksum(join(bundlePath, bundleImage.archive)) !== bundleImage.sha256) fail("OFFLINE_CHECKSUM_INVALID", "Offline image checksum verification failed.");
  }
  return selected.map((image) => ({ ...image, reference: image.offlineRef.replace("$VERSION", descriptor.version), checksum: byId.get(image.id).sha256 }));
}

export function resolveRelease({ configuration, descriptorPath, offlineBundlePath } = {}) {
  const descriptor = loadReleaseDescriptor(descriptorPath);
  if (!configuration || configuration.mode !== "docker" || !Array.isArray(configuration.runtimeProfiles) || !configuration.runtimeProfiles.includes("core")) fail("RELEASE_PROFILE_INVALID", "Docker setup must include the core runtime profile.");
  if (configuration.runtimeProfiles.some((profile) => !PROFILES.has(profile))) fail("RELEASE_PROFILE_INVALID", "Requested runtime profile is not supported by this release.");
  const selected = descriptor.images.filter((image) => configuration.runtimeProfiles.includes(image.profile));
  const images = configuration.source === "offline"
    ? verifyOfflineBundle(offlineBundlePath || process.env.ARCHIVE_OFFLINE_BUNDLE_PATH, descriptor, selected)
    : selected.map((image) => ({ ...image, reference: image.online, digest: image.online.slice(image.online.lastIndexOf("@") + 1) }));
  const environment = { ARCHIVE_RELEASE_PULL_POLICY: configuration.source === "offline" ? "never" : "missing", ARCHIVE_COMPOSE_PROFILES: configuration.runtimeProfiles.filter((profile) => profile !== "core").join(",") };
  for (const image of images) environment[envName(image.id)] = image.reference;
  return { descriptor, images, environment, artifacts: images.map((image) => ({ id: image.id, digest: image.digest, checksum: image.checksum })) };
}
