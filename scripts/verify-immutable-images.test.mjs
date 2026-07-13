import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const dockerfiles = ["archive-next/Dockerfile", "archive-laravel/Dockerfile.worker"];
const productionWorkflows = [".github/workflows/release.yml", ".github/workflows/docker.yml"];

test("production Dockerfile base images use readable tags pinned by sha256 digest", () => {
  for (const path of dockerfiles) {
    const fromLines = read(path).match(/^FROM\s+\S+(?:\s+AS\s+\S+)?$/gim) ?? [];
    assert.ok(fromLines.length > 0, `${path} must contain at least one FROM instruction`);
    for (const line of fromLines) {
      if (!/^FROM\s+[^\s]+:/i.test(line)) continue;
      assert.match(
        line,
        /^FROM\s+[^\s@]+:[^\s@]+@sha256:[a-f0-9]{64}(?:\s+AS\s+\S+)?$/i,
        `${path} must pin every external base image by digest while retaining its version tag`,
      );
    }
  }
});

test("production image publishing never creates or consumes latest tags", () => {
  for (const path of productionWorkflows) {
    assert.doesNotMatch(read(path), /(?:^|[\s"'])[^\s"']+:latest(?:$|[\s"'])/m, `${path} must not use :latest`);
  }
});

test("release manifest records version plus digest for both canonical images", () => {
  const release = read(".github/workflows/release.yml");
  assert.match(release, /\$\{NEXT_IMAGE\}:\$\{\{ steps\.meta\.outputs\.version \}\}@\$\{\{ steps\.push_next\.outputs\.digest \}\}/);
  assert.match(release, /\$\{LARAVEL_IMAGE\}:\$\{\{ steps\.meta\.outputs\.version \}\}@\$\{\{ steps\.push_laravel\.outputs\.digest \}\}/);
});

test("release workflow smoke-tests and vulnerability-scans both built images", () => {
  const release = read(".github/workflows/release.yml");
  for (const image of ["NEXT_IMAGE", "LARAVEL_IMAGE"]) {
    assert.match(release, new RegExp(`docker run[^\\n]+\\$\\{${image}\\}:\\$\\{\\{ steps\\.meta\\.outputs\\.version \\}\\}`));
    assert.match(release, new RegExp(`aquasecurity/trivy-action[^]*image-ref: \\"?\\$\\{\\{ env\\.${image} \\}\\}:\\$\\{\\{ steps\\.meta\\.outputs\\.version \\}\\}`));
  }
  assert.match(release, /docker run --rm --env ARCHIVE_SECURE_COOKIES=true "\$\{LARAVEL_IMAGE\}/);
  assert.match(release, /severity:\s*["']?CRITICAL["']?/);
  assert.match(release, /exit-code:\s*["']?1["']?/);
});
