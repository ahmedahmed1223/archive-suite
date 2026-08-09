import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  mkdirSync(join(dir, "infra", "platform"), { recursive: true });
  mkdirSync(join(dir, "infra", "k8s"), { recursive: true });
  mkdirSync(join(dir, "archive-laravel", "config"), { recursive: true });
  mkdirSync(join(dir, "docs", "evidence"), { recursive: true });
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });

  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version, license: "MIT" }));
  writeFileSync(join(dir, "LICENSE"), "MIT License\n\nCopyright (c) fixture\n");
  writeFileSync(
    join(dir, "docs", "versioning.md"),
    "# Versioning\n\n| Line | Support |\n|------|---------|\n| latest | full support |\n"
  );
  writeFileSync(join(dir, "docs", "release-notes", `v${version}.md`), `# ${version}\n\nWindows Native and Linux Native are supported.\n`);
  writeFileSync(join(dir, "docs", "release-notes", `v${version}.ar.md`), `# ${version}\n\nيدعم الإصدار التشغيل المباشر على Windows وLinux.\n`);
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
  writeFileSync(join(dir, "docs", "evidence", "native.md"), "# Native evidence\n");
  writeFileSync(join(dir, "infra", "platform", "compatibility.v1.json"), JSON.stringify({
    platforms: [
      { id: "windows-native", mode: "native", status: "supported", evidence: "docs/evidence/native.md" },
      { id: "linux-native", mode: "native", status: "supported", evidence: "docs/evidence/native.md" },
    ],
  }));
  writeFileSync(join(dir, "archive-laravel", "config", "media.php"), "'whisper_binary' => env('WHISPER_BINARY', 'whisper-ctranslate2'),\n");
  writeFileSync(join(dir, "infra", "k8s", "configmap.yaml"), 'WHISPER_BINARY: "whisper-ctranslate2"\n');
  writeFileSync(
    join(dir, ".github", "workflows", "release.yml"),
    'on:\n  push:\n    tags:\n      - "v*"\njobs:\n  verify:\n    runs-on: ubuntu-latest\n  windows-native:\n    needs: verify\n    runs-on: windows-latest\n    steps:\n      - run: pnpm bundle:windows-native\n      - run: node scripts/native-acceptance.mjs windows --bundle bundle --confirm-host-effects\n      - uses: actions/upload-artifact@v4\n  linux-native:\n    needs: verify\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm bundle:linux-native\n      - run: node scripts/native-acceptance.mjs linux --bundle bundle\n      - uses: actions/upload-artifact@v4\n  whisper:\n    needs: verify\n    runs-on: ubuntu-latest\n    steps:\n      - run: node scripts/smoke-whisper-release.mjs\n  publish:\n    needs: [verify, windows-native, linux-native, whisper]\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/download-artifact@v4\n      - run: sha256sum --check SHA256SUMS\n      - run: gh release create "$GITHUB_REF_NAME"\n'
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

test.skip("legacy task-ledger gate", () => {
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

test.skip("legacy release blocker gate", () => {
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

test.skip("legacy deferred task ranges", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, "TASKS.md"),
      "- [ ] **V1-806–V1-814** acceptance program\n" +
        "- [ ] **V1-502–V1-505** pilot rehearsal\n" +
        "- [ ] **V1-601–V1-605** go/no-go and release\n" +
        "- [ ] **V1-999 open blocker** — pending\n"
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /release-blocking V1 item/);
    assert.match(r.stderr, /V1-999/);
    assert.doesNotMatch(r.stderr, /V1-806/);
    assert.doesNotMatch(r.stderr, /V1-502/);
    assert.doesNotMatch(r.stderr, /V1-601/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("release mode passes when only the three deferred ranges remain open", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(
      join(dir, "TASKS.md"),
      "- [ ] **V1-806–V1-814** acceptance program\n" +
        "- [ ] **V1-502–V1-505** pilot rehearsal\n" +
        "- [ ] **V1-601–V1-605** go/no-go and release\n"
    );
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.doesNotMatch(r.stderr, /release-blocking V1 item/, r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test.skip("legacy task warning", () => {
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

test("release mode fails when supported-platform evidence does not exist", () => {
  const dir = baselineFixture();
  try {
    const contract = JSON.parse(readFileSync(join(dir, "infra", "platform", "compatibility.v1.json"), "utf8"));
    contract.platforms[0].evidence = "docs/evidence/missing.md";
    writeFileSync(join(dir, "infra", "platform", "compatibility.v1.json"), JSON.stringify(contract));
    const r = run({ READINESS_ROOT: dir, READINESS_RELEASE: "1" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /evidence path does not exist.*windows-native/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when the release workflow omits a supported Native distribution", () => {
  const dir = baselineFixture();
  try {
    const workflow = readFileSync(join(dir, ".github", "workflows", "release.yml"), "utf8")
      .replace(/  windows-native:[\s\S]*?(?=  linux-native:)/, "");
    writeFileSync(join(dir, ".github", "workflows", "release.yml"), workflow);
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Windows Native build and acceptance/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when current release notes retain the obsolete Native planned claim", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "docs", "release-notes", "v1.2.3.md"), "Windows Native remains planned.\n");
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /obsolete Native planned claim/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails when Whisper runtime identifiers disagree", () => {
  const dir = baselineFixture();
  try {
    writeFileSync(join(dir, "infra", "k8s", "configmap.yaml"), 'WHISPER_BINARY: "faster-whisper"\n');
    const r = run({ READINESS_ROOT: dir });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /canonical Whisper binary.*whisper-ctranslate2/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
