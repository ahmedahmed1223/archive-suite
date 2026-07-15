// V1-211A: Linux Native service topology and package manifest. One signed
// artifact from a single commit runs Next standalone, PHP-FPM, the queue
// worker, Reverb, and the scheduler as separate systemd units under a
// non-interactive service user. Same DI style as windows-services.mjs: pure
// validation and rendering, no filesystem access here.
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN = /(password|secret|token|credential|authorization|cookie|dsn|connection|key)/i;

// Decisions per docs/superpowers/specs/2026-07-15-v1-211-linux-native-decisions.md.
export const LINUX_SERVICE_USER = Object.freeze({ name: "archive", shell: "/usr/sbin/nologin", home: "/opt/archive-suite" });

export const LINUX_SERVICES = Object.freeze([
  { id: "archive-http", description: "Archive HTTP front — TLS termination and reverse proxy for Next and PHP-FPM", command: "/opt/archive-suite/runtime/caddy/caddy run --config /opt/archive-suite/config/Caddyfile" },
  { id: "archive-next", description: "Archive Next.js standalone server", command: "/opt/archive-suite/runtime/node/bin/node /opt/archive-suite/app/next/server.js" },
  { id: "archive-php-fpm", description: "Archive Laravel PHP-FPM pool", command: "/opt/archive-suite/runtime/php/sbin/php-fpm -F -y /opt/archive-suite/config/php-fpm.conf" },
  { id: "archive-worker", description: "Archive Laravel queue worker", command: "/opt/archive-suite/runtime/php/bin/php /opt/archive-suite/app/laravel/artisan queue:work --tries=3" },
  { id: "archive-reverb", description: "Archive Reverb websocket server", command: "/opt/archive-suite/runtime/php/bin/php /opt/archive-suite/app/laravel/artisan reverb:start" },
  { id: "archive-scheduler", description: "Archive Laravel scheduler", command: "/opt/archive-suite/runtime/php/bin/php /opt/archive-suite/app/laravel/artisan schedule:work" },
].map((service) => Object.freeze({ ...service, unit: `${service.id}.service`, user: LINUX_SERVICE_USER.name })));

export class LinuxPackageError extends Error {
  constructor(code, message, nextActions = ["Correct the Linux package input and rebuild the artifact."]) { super(message); this.code = code; this.nextActions = nextActions; }
}

function fail(code, message, nextActions) { throw new LinuxPackageError(code, message, nextActions); }

// One systemd unit per service: non-interactive user, auto-restart, and
// baseline hardening so a compromised service cannot rewrite the system.
export function renderSystemdUnit(service) {
  if (!LINUX_SERVICES.some((known) => known.id === service?.id)) fail("LINUX_SERVICE_UNKNOWN", "Only the fixed Archive service topology can be rendered.");
  return [
    "[Unit]",
    `Description=${service.description}`,
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    `User=${service.user}`,
    `Group=${service.user}`,
    `ExecStart=${service.command}`,
    "Restart=on-failure",
    "RestartSec=10",
    "NoNewPrivileges=true",
    "ProtectSystem=strict",
    "ReadWritePaths=/opt/archive-suite/storage /opt/archive-suite/logs",
    "PrivateTmp=true",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
  ].join("\n");
}

// Closed package manifest: version+commit binding, per-file SHA-256, SBOM,
// and a required detached artifact signature (minisign/cosign in the release
// workflow); this validates the evidence, it does not sign.
export function buildLinuxPackageManifest({ version, commit, files, artifactSignature } = {}) {
  if (!SEMVER.test(String(version || ""))) fail("LINUX_PACKAGE_VERSION_INVALID", "The package version must be a semantic version.");
  if (!COMMIT.test(String(commit || ""))) fail("LINUX_PACKAGE_COMMIT_INVALID", "The package must be built from a single full commit hash.");
  if (!Array.isArray(files) || files.length === 0) fail("LINUX_PACKAGE_FILES_REQUIRED", "The package requires at least one payload file.");
  const paths = new Set();
  for (const file of files) {
    if (typeof file?.path !== "string" || !file.path.trim() || !SHA256.test(String(file.sha256 || ""))) fail("LINUX_PACKAGE_FILE_INVALID", "Every payload file needs a path and SHA-256 checksum.");
    if (paths.has(file.path)) fail("LINUX_PACKAGE_FILE_DUPLICATE", "Payload files cannot repeat.");
    paths.add(file.path);
  }
  if (typeof artifactSignature?.signature !== "string" || !artifactSignature.signature.trim() || typeof artifactSignature?.keyId !== "string" || !artifactSignature.keyId.trim()) {
    fail("LINUX_PACKAGE_UNSIGNED", "The artifact requires a detached signature from the release workflow.", ["Sign the artifact with the release signing workflow before packaging."]);
  }
  const manifest = {
    schemaVersion: "1.0",
    platform: "linux-native",
    version,
    commit,
    serviceUser: { ...LINUX_SERVICE_USER },
    services: LINUX_SERVICES.map((service) => ({ ...service })),
    files: files.map((file) => ({ path: file.path, sha256: file.sha256 })),
    signature: { signature: artifactSignature.signature, keyId: artifactSignature.keyId },
    sbom: files.map((file) => ({ component: file.path, version: `${version}+${commit.slice(0, 12)}`, sha256: file.sha256, role: "payload" })),
  };
  if (FORBIDDEN.test(JSON.stringify({ ...manifest, signature: undefined }))) fail("LINUX_PACKAGE_SENSITIVE", "The package manifest must not contain credentials or secrets.");
  return manifest;
}
