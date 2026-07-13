import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const release = read(".github/workflows/release.yml");
const toolchain = JSON.parse(read("infra/platform/toolchain.v1.json"));

test("release signs and verifies both immutable image digests with keyless Cosign", () => {
  assert.match(release, /permissions:[^]*id-token:\s*write/);
  assert.match(release, /sigstore\/cosign-installer@/);
  for (const digestStep of ["push_next", "push_laravel"]) {
    const digest = `steps.${digestStep}.outputs.digest`;
    assert.match(release, new RegExp(`cosign sign[^\\n]+${digest.replaceAll(".", "\\.")}`));
    assert.match(release, new RegExp(`cosign verify[^\\n]+${digest.replaceAll(".", "\\.")}`));
  }
  assert.match(release, /--certificate-identity\s/);
  assert.match(release, /--certificate-oidc-issuer/);
});

test("release creates downloadable SBOMs for both canonical images", () => {
  assert.match(release, /anchore\/sbom-action@/);
  assert.match(release, /next-image\.spdx\.json/);
  assert.match(release, /laravel-image\.spdx\.json/);
  assert.match(release, /steps\.push_next\.outputs\.digest/);
  assert.match(release, /steps\.push_laravel\.outputs\.digest/);
});

test("release inventories and enforces licenses for pnpm and Composer", () => {
  assert.match(release, new RegExp(`tools: composer:${toolchain.composer.replaceAll(".", "\\.")}`));
  assert.match(release, /pnpm-licenses\.json/);
  assert.match(release, /composer-licenses\.json/);
  assert.match(release, /verify-release-licenses\.mjs/);
  const policy = JSON.parse(read("config/release-license-policy.json"));
  assert.ok(policy.allowed.length > 0);
  assert.ok(policy.forbidden.length > 0);
  assert.deepEqual(policy.exceptions, []);
  assert.match(policy.expressionSemantics, /OR.+alternative.+AND.+all/i);
});

test("release checksums every downloadable artifact and attaches them together", () => {
  assert.match(release, /sha256sum[^]*release-images\.txt[^]*next-image\.spdx\.json[^]*laravel-image\.spdx\.json[^]*pnpm-licenses\.json[^]*composer-licenses\.json[^]*SHA256SUMS/);
  assert.match(release, /gh release create[^]*release-images\.txt[^]*next-image\.spdx\.json[^]*laravel-image\.spdx\.json[^]*pnpm-licenses\.json[^]*composer-licenses\.json[^]*SHA256SUMS/);
});

test("release publish permissions are limited to required capabilities", () => {
  assert.match(release, /publish:[^]*permissions:\s*\n\s+contents:\s*write\s*\n\s+packages:\s*write\s*\n\s+id-token:\s*write/);
  assert.doesNotMatch(release, /permissions:\s*write-all/);
});
