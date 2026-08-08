import assert from "node:assert/strict";
import test from "node:test";

import { WINDOWS_SERVICES, WINDOWS_SERVICE_WRAPPER, buildWindowsPackageManifest, renderServiceDefinition } from "./windows-services.mjs";

const SHA = "a".repeat(64);
const COMMIT = "b".repeat(40);
const baseInput = () => ({
  version: "1.0.0",
  commit: COMMIT,
  wrapperSha256: SHA,
  files: [
    { path: "runtime\\winsw\\winsw-2.12.0.exe", sha256: SHA },
    { path: "app\\next\\server.js", sha256: SHA },
  ],
  signatures: [{ path: "runtime\\winsw\\winsw-2.12.0.exe", signature: "MIIB-synthetic", thumbprint: "THUMB1234" }],
});

test("Windows topology runs every required component under its own limited virtual account", () => {
  const ids = WINDOWS_SERVICES.map((service) => service.id);
  assert.deepEqual(ids, ["archive-http", "archive-next", "archive-php-fcgi", "archive-worker", "archive-reverb", "archive-scheduler"]);
  for (const service of WINDOWS_SERVICES) {
    assert.equal(service.account, `NT SERVICE\\${service.id}`);
    assert.equal(service.wrapper, `${WINDOWS_SERVICE_WRAPPER.name}@${WINDOWS_SERVICE_WRAPPER.version}`);
  }
});

test("service definition renders the pinned wrapper XML with restart and rolling logs, without an inline serviceaccount", () => {
  const xml = renderServiceDefinition(WINDOWS_SERVICES[1]);
  assert.match(xml, /<id>archive-next<\/id>/);
  // WinSW validates <serviceaccount> against a real, pre-existing account
  // before it creates the service -- it cannot resolve NT SERVICE\<id> since
  // that virtual account doesn't exist until the service itself does
  // (confirmed against real WinSW: "Failed to find the account. No mapping
  // between account names and security IDs was done."). The XML must not
  // reference it; the virtual account is assigned afterward via
  // `sc config <id> obj=`, Microsoft's documented two-step pattern.
  assert.doesNotMatch(xml, /serviceaccount/);
  // WinSW defaults the working directory to the folder holding the WinSW
  // exe (installRoot\services), not the install root -- so every relative
  // argument (config\Caddyfile, app\next\server.js, app\laravel\artisan)
  // fails to resolve (confirmed against real WinSW: "reading config from
  // file: open config\Caddyfile: The system cannot find the path
  // specified."). %BASE% is the WinSW macro for the folder holding the XML.
  assert.match(xml, /<workingdirectory>%BASE%\\\.\.<\/workingdirectory>/);
  assert.match(xml, /onfailure action="restart"/);
  assert.match(xml, /roll-by-size/);
  assert.throws(() => renderServiceDefinition({ id: "rogue-service" }), (error) => error.code === "WINDOWS_SERVICE_UNKNOWN");
});

test("Next WinSW definition pins the local Caddy upstream host and port", () => {
  const nextXml = renderServiceDefinition(WINDOWS_SERVICES.find(({ id }) => id === "archive-next"));
  assert.match(nextXml, /<env name="HOSTNAME" value="127\.0\.0\.1"\/>/);
  assert.match(nextXml, /<env name="PORT" value="3000"\/>/);
  assert.doesNotMatch(renderServiceDefinition(WINDOWS_SERVICES.find(({ id }) => id === "archive-worker")), /name="HOSTNAME"/);
});

test("package manifest binds version and commit, lists the pinned wrapper in the SBOM, and checksums every file", () => {
  const manifest = buildWindowsPackageManifest(baseInput());
  assert.equal(manifest.platform, "windows-10-11-native");
  assert.equal(manifest.commit, COMMIT);
  assert.equal(manifest.wrapper.version, "2.12.0");
  assert.equal(manifest.sbom[0].role, "service-wrapper");
  assert.equal(manifest.sbom[0].sha256, SHA);
  assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.equal(manifest.files[0].signedBy, "THUMB1234");
});

test("package manifest rejects unsigned executables, missing wrapper checksum, and duplicate files", () => {
  assert.throws(() => buildWindowsPackageManifest({ ...baseInput(), signatures: [] }), (error) => error.code === "WINDOWS_PACKAGE_UNSIGNED");
  assert.throws(() => buildWindowsPackageManifest({ ...baseInput(), wrapperSha256: "short" }), (error) => error.code === "WINDOWS_WRAPPER_CHECKSUM_INVALID");
  const duplicated = baseInput();
  duplicated.files.push({ ...duplicated.files[1] });
  assert.throws(() => buildWindowsPackageManifest(duplicated), (error) => error.code === "WINDOWS_PACKAGE_FILE_DUPLICATE");
  assert.throws(() => buildWindowsPackageManifest({ ...baseInput(), commit: "not-a-commit" }), (error) => error.code === "WINDOWS_PACKAGE_COMMIT_INVALID");
});
