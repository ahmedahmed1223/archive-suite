import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Smoke tests for the release-readiness content gate. The real repo is
// exercised directly (no env override); fixture-based tests point the script
// at a throwaway directory via READINESS_ROOT to isolate one failure at a
// time. The script collects *all* failing checks per run (not fail-fast), so
// a fixture missing unrelated files (e.g. no infra/ dir) will report extra
// failures alongside the one under test — tests only assert on the specific
// message they care about.

const CLI = new URL("./verify-release-readiness.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const run = (env = {}) => spawnSync(process.execPath, [CLI], { encoding: "utf8", env: { ...process.env, ...env } });

function baselineFixture(version = "1.2.3") {
  const dir = mkdtempSync(join(tmpdir(), "readiness-"));
  mkdirSync(join(dir, "docs", "release-notes"), { recursive: true });
  mkdirSync(join(dir, "docs", "api"), { recursive: true });
  mkdirSync(join(dir, "infra"), { recursive: true });
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version, license: "MIT" }));
  writeFileSync(join(dir, "LICENSE"), "MIT License\n\nCopyright (c) fixture\n");
  writeFileSync(
    join(dir, "docs", "versioning.md"),
    "# Versioning\n\n| Line | Support |\n|------|---------|\n| latest | full support |\n"
  );
  writeFileSync(join(dir, "docs", "release-notes", `v${version}.md`), `# ${version}\n`);
  writeFileSync(
    join(dir, "docs", "api", "archive-contract.openapi.json"),
    JSON.stringify({ info: { version: "1.0.0" }, paths: { "/x": {} } })
  );
  writeFileSync(join(dir, "TASKS.md"), "- [x] done item **(P0 #1)**\n");
  writeFileSync(
    join(dir, "infra", "docker-compose.yml"),
    "services:\n  app:\n    environment:\n      FOO: ${FOO:?Set FOO in .env}\n"
  );
  writeFileSync(join(dir, "infra", ".env.example"), "FOO=bar\n");
  writeFileSync(
    join(dir, ".github", "workflows", "release.yml"),
    'on:\n  push:\n    tags:\n      - "v*"\njobs:\n  verify:\n    runs-on: ubuntu-latest\n  publish:\n    needs: verify\n    runs-on: ubuntu-latest\n'
  );
  return dir;
}

test("passes on the real repo", () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /ok - release readiness content verified/);
});

test("fails when LICENSE is missing", () => {
  const dir = baselineFixture();
  try {
    rmSync(join(dir, "LICENSE"), { force: true });
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /LICENSE is missing at the repo root/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails on an invalid SemVer version", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "not-a-version" }));
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /is not valid SemVer/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when release notes for the current version are missing", () => {
  const dir = baselineFixture("9.9.9");
  try {
    rmSync(join(dir, "docs", "release-notes", "v9.9.9.md"), { force: true });
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /docs\/release-notes\/v9\.9\.9\.md is missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when TASKS.md has an unchecked P0 item", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "TASKS.md"), "- [ ] still broken **(P0 #2)**\n");
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unchecked P0 item/);
    assert.match(r.stderr, /P0 #2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when .env.example is missing a required compose variable", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "infra", ".env.example"), "UNRELATED=1\n");
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /is missing required variable\(s\) referenced by .*docker-compose\.yml: FOO/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when the OpenAPI contract has no paths", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, "docs", "api", "archive-contract.openapi.json"),
      JSON.stringify({ info: { version: "1.0.0" }, paths: {} })
    );
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /paths must be a non-empty object/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release mode fails when TASKS.md has an unchecked V1 blocker", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, "TASKS.md"),
      "- [ ] **V1-999 open blocker** — pending\n- [x] **V1-100 done** — done\n"
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /release-blocking V1 item/);
    assert.match(r.stderr, /V1-999/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release mode ignores optional V1-X items and backlog B items", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, "TASKS.md"),
      "- [ ] **V1-X01 optional capability** — conditional\n- [ ] **B01** backlog idea\n"
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.doesNotMatch(r.stderr, /release-blocking V1 item/, r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("non-release mode only warns about open V1 blockers", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "TASKS.md"), "- [ ] **V1-999 open blocker** — pending\n");
    const r = run({ READINESS_ROOT: dir });
    assert.doesNotMatch(r.stderr, /release-blocking V1 item/, r.stderr);
    assert.match(r.stdout + r.stderr, /V1 release blocker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release mode fails when a platform claims supported without evidence", () => {
  const dir = baselineFixture();
  try {
    mkdirSync(join(dir, "infra", "platform"), { recursive: true });
    writeFileSync(
      join(dir, "infra", "platform", "compatibility.v1.json"),
      JSON.stringify({
        platforms: [{ id: "linux-docker", status: "supported" }],
      })
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /"supported" without evidence/);
    assert.match(r.stderr, /linux-docker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release mode accepts supported platforms that carry evidence", () => {
  const dir = baselineFixture();
  try {
    mkdirSync(join(dir, "infra", "platform"), { recursive: true });
    writeFileSync(
      join(dir, "infra", "platform", "compatibility.v1.json"),
      JSON.stringify({
        platforms: [
          { id: "linux-docker", status: "supported", evidence: "docs/ops/linux-docker-acceptance.md" },
          { id: "windows-native", status: "planned" },
        ],
      })
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.doesNotMatch(r.stderr, /"supported" without evidence/, r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when release.yml has no publish job that needs verify", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, ".github", "workflows", "release.yml"),
      'on:\n  push:\n    tags:\n      - "v*"\njobs:\n  verify:\n    runs-on: ubuntu-latest\n  publish:\n    runs-on: ubuntu-latest\n'
    );
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /publish" job must declare needs: verify/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
