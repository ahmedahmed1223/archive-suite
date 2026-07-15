// V1-210A: Windows Native service topology and package manifest. The package
// is built once from a single commit; every payload file is checksummed, the
// service wrapper is version-pinned and listed in the SBOM, and every
// executable must carry an Authenticode signature entry before the manifest
// is accepted. Same DI style as release-descriptor.mjs: pure validation, no
// filesystem or registry access here.
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const COMMIT = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN = /(password|secret|token|credential|authorization|cookie|dsn|connection|key)/i;

// Pinned per docs/superpowers/specs/2026-07-15-v1-210-windows-native-decisions.md.
// The executable checksum is supplied at build time from the vendored binary.
export const WINDOWS_SERVICE_WRAPPER = Object.freeze({ name: "winsw", version: "2.12.0", executable: "runtime\\winsw\\winsw-2.12.0.exe" });

// Each service runs under its own virtual service account (NT SERVICE\<id>):
// no password to manage, no interactive logon, least privilege by default.
export const WINDOWS_SERVICES = Object.freeze([
  { id: "archive-http", description: "Archive HTTP front — TLS termination and reverse proxy for Next and Laravel FastCGI", executable: "runtime\\caddy\\caddy.exe", arguments: "run --config config\\Caddyfile" },
  { id: "archive-next", description: "Archive Next.js standalone server", executable: "runtime\\node\\node.exe", arguments: "app\\next\\server.js" },
  { id: "archive-php-fcgi", description: "Archive Laravel FastCGI pool", executable: "runtime\\php\\php-cgi.exe", arguments: "-b 127.0.0.1:9000" },
  { id: "archive-worker", description: "Archive Laravel queue worker", executable: "runtime\\php\\php.exe", arguments: "app\\laravel\\artisan queue:work --tries=3" },
  { id: "archive-reverb", description: "Archive Reverb websocket server", executable: "runtime\\php\\php.exe", arguments: "app\\laravel\\artisan reverb:start" },
  { id: "archive-scheduler", description: "Archive Laravel scheduler", executable: "runtime\\php\\php.exe", arguments: "app\\laravel\\artisan schedule:work" },
].map((service) => Object.freeze({ ...service, account: `NT SERVICE\\${service.id}`, wrapper: `${WINDOWS_SERVICE_WRAPPER.name}@${WINDOWS_SERVICE_WRAPPER.version}` })));

export class WindowsPackageError extends Error {
  constructor(code, message, nextActions = ["Correct the Windows package input and rebuild the artifact."]) { super(message); this.code = code; this.nextActions = nextActions; }
}

function fail(code, message, nextActions) { throw new WindowsPackageError(code, message, nextActions); }
const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char]));

// WinSW definition for one service: auto-restart on failure, rolling logs
// under the install root so log ACLs are owned by the installation.
export function renderServiceDefinition(service) {
  if (!WINDOWS_SERVICES.some((known) => known.id === service?.id)) fail("WINDOWS_SERVICE_UNKNOWN", "Only the fixed Archive service topology can be rendered.");
  return [
    "<service>",
    `  <id>${escapeXml(service.id)}</id>`,
    `  <name>${escapeXml(service.id)}</name>`,
    `  <description>${escapeXml(service.description)}</description>`,
    `  <executable>%BASE%\\..\\${escapeXml(service.executable)}</executable>`,
    `  <arguments>${escapeXml(service.arguments)}</arguments>`,
    `  <serviceaccount><username>${escapeXml(service.account)}</username><allowservicelogon>true</allowservicelogon></serviceaccount>`,
    "  <onfailure action=\"restart\" delay=\"10 sec\"/>",
    "  <log mode=\"roll-by-size\"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>",
    "</service>",
  ].join("\n");
}

// Builds the closed package manifest: version+commit binding, per-file
// checksums, SBOM (wrapper included), and required signature entries for
// every executable payload. Signing itself happens in the release workflow
// (signtool via the injected signature list); this validates the evidence.
export function buildWindowsPackageManifest({ version, commit, files, wrapperSha256, signatures } = {}) {
  if (!SEMVER.test(String(version || ""))) fail("WINDOWS_PACKAGE_VERSION_INVALID", "The package version must be a semantic version.");
  if (!COMMIT.test(String(commit || ""))) fail("WINDOWS_PACKAGE_COMMIT_INVALID", "The package must be built from a single full commit hash.");
  if (!SHA256.test(String(wrapperSha256 || ""))) fail("WINDOWS_WRAPPER_CHECKSUM_INVALID", "The pinned service wrapper requires its SHA-256 checksum.", ["Vendor the pinned WinSW binary and record its checksum."]);
  if (!Array.isArray(files) || files.length === 0) fail("WINDOWS_PACKAGE_FILES_REQUIRED", "The package requires at least one payload file.");
  const paths = new Set();
  for (const file of files) {
    if (typeof file?.path !== "string" || !file.path.trim() || !SHA256.test(String(file.sha256 || ""))) fail("WINDOWS_PACKAGE_FILE_INVALID", "Every payload file needs a path and SHA-256 checksum.");
    if (paths.has(file.path)) fail("WINDOWS_PACKAGE_FILE_DUPLICATE", "Payload files cannot repeat.");
    paths.add(file.path);
  }
  const signed = new Map((Array.isArray(signatures) ? signatures : []).map((entry) => [entry?.path, entry]));
  for (const file of files) {
    if (!file.path.toLowerCase().endsWith(".exe")) continue;
    const signature = signed.get(file.path);
    if (!signature || typeof signature.thumbprint !== "string" || !signature.thumbprint.trim() || typeof signature.signature !== "string" || !signature.signature.trim()) {
      fail("WINDOWS_PACKAGE_UNSIGNED", `Executable "${file.path}" is missing its Authenticode signature entry.`, ["Sign every executable with the release certificate before packaging."]);
    }
  }
  const manifest = {
    schemaVersion: "1.0",
    platform: "windows-10-11-native",
    version,
    commit,
    services: WINDOWS_SERVICES.map((service) => ({ ...service })),
    wrapper: { ...WINDOWS_SERVICE_WRAPPER, sha256: wrapperSha256 },
    files: files.map((file) => ({ path: file.path, sha256: file.sha256, ...(signed.has(file.path) ? { signedBy: signed.get(file.path).thumbprint } : {}) })),
    sbom: [
      { component: WINDOWS_SERVICE_WRAPPER.name, version: WINDOWS_SERVICE_WRAPPER.version, sha256: wrapperSha256, role: "service-wrapper" },
      ...files.map((file) => ({ component: file.path, version: `${version}+${commit.slice(0, 12)}`, sha256: file.sha256, role: "payload" })),
    ],
  };
  if (FORBIDDEN.test(JSON.stringify(manifest))) fail("WINDOWS_PACKAGE_SENSITIVE", "The package manifest must not contain credentials or secrets.");
  return manifest;
}
