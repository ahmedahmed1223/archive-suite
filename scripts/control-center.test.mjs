import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSetupConfiguration } from "./control-center/setup-config.mjs";
import { collectWizardRuntimeChoices, requestWizardConfirmation } from "./control-center/setup-wizard.mjs";
import { applySafeMigration } from "./control-center/operations.mjs";
import { runInteractiveMenu } from "./control-center/cli.mjs";
import { loadPlatformContract } from "./platform-contract.mjs";

// Smoke tests for the Control Center CLI. They exercise the real binary through
// its non-interactive subcommand router (no module refactor needed) so the menu,
// router, and read-only commands are covered end-to-end.

const CLI = new URL("./control-center.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const run = (args, env = {}) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

const validSetupConfig = (overrides = {}) => ({
  schemaVersion: "1.0",
  mode: "docker",
  platform: "linux-docker",
  source: "online",
  intent: "fresh",
  access: "local",
  runtimeProfiles: ["core"],
  capabilities: [],
  dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
  storage: { driver: "local", path: "/srv/archive-suite/storage" },
  ...overrides,
});

test("public setup and deployment guidance use only the canonical Control Center stack", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.setup, "node scripts/control-center.mjs deploy");
  assert.equal(pkg.scripts.deploy, "node scripts/control-center.mjs deploy");

  const controlCenter = readFileSync(join(ROOT, "scripts/control-center.mjs"), "utf8");
  assert.doesNotMatch(controlCenter, /docker-compose\.dev\.yml/);

  for (const file of [
    "README.md",
    "INSTALL.md",
    "DEPLOYMENT.md",
    "docs/control-center.md",
    "Setup-Archive.bat",
    "setup.bat",
    "setup.sh",
    "scripts/control-center.mjs",
    "infra/deploy/setup.sh",
    "infra/deploy/hostinger-vps.md",
    "infra/.env.example",
    "infra/docker-compose.yml",
  ]) {
    const content = readFileSync(join(ROOT, file), "utf8");
    assert.doesNotMatch(content, /deploy-legacy|PocketBase|archive-server|docker-compose\.postgres\.yml/i);
  }

  for (const file of ["README.md", "INSTALL.md", "DEPLOYMENT.md", "docs/control-center.md", "infra/deploy/hostinger-vps.md"]) {
    assert.match(readFileSync(join(ROOT, file), "utf8"), /infra\/docker-compose\.yml/);
  }

  const deployLauncher = readFileSync(join(ROOT, "infra/deploy/setup.sh"), "utf8");
  assert.match(deployLauncher, /exec bash "\$ROOT\/setup\.sh" "\$@"/);
  assert.doesNotMatch(deployLauncher, /exec sh "\$ROOT\/setup\.sh"/);
  for (const retiredOverride of [
    "infra/docker-compose.intranet.yml",
    "infra/docker-compose.lite.yml",
    "infra/docker-compose.test.local.yml",
  ]) {
    assert.equal(existsSync(join(ROOT, retiredOverride)), false, `${retiredOverride} must not remain a public deployment path`);
  }
});

test("help renders the grouped menu and every command group", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  for (const s of [
    "Masar",
    "— Server —", "— Configure —", "— Security —", "— Database —", "— Backups —", "— Maintain —",
    "1) Guided setup", "2) Quick start", "5) Development deploy / re-provision", "15) Generate a strong password", "16) Change admin password",
    "20) Seed demo data", "24) Verify a backup", "26) Development update & rebuild", "0) Exit", "q) Exit",
  ]) {
    assert.ok(clean.includes(s), `help output should include "${s}"`);
  }
  assert.ok(!clean.includes("q) Quick start"), "q should be reserved for exit, not start/deploy");
  assert.ok(!clean.includes("Legacy"), "legacy Node/Vite commands were removed with the legacy packages");
});

test("unknown command exits non-zero and lists the valid commands", () => {
  const r = run(["definitely-not-a-command"]);
  assert.notEqual(r.status, 0);
  const out = r.stderr + r.stdout;
  assert.match(out, /Unknown command/);
  assert.match(out, /status, start, stop/);
});

test("q command exits successfully instead of starting deployment", () => {
  const r = run(["q"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
  assert.equal(r.stderr.trim(), "");
});

test("piped input without a named command refuses to open the interactive menu", () => {
  const r = spawnSync(process.execPath, [CLI], { input: "q\n", encoding: "utf8", env: { ...process.env } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No interactive terminal detected/i);
  assert.match(r.stderr, /setup help/i);
  assert.doesNotMatch(r.stdout, /Masar — Control Center|Choose an option/i);
});

test("interactive menu acknowledges a completed operation once before returning", async () => {
  const prompts = ["1", "", "q"];
  let executions = 0;
  const result = await runInteractiveMenu({
    prompt: async () => prompts.shift(),
    log: () => {},
    warn: () => {},
    menuItems: [["1", "Status", async () => { executions += 1; }]],
  });

  assert.equal(result, "quit");
  assert.equal(executions, 1);
});

test("interactive acknowledgement q exits without rerunning the command", async () => {
  const prompts = ["1", "q"];
  let executions = 0;
  const result = await runInteractiveMenu({
    prompt: async () => prompts.shift(),
    log: () => {},
    warn: () => {},
    menuItems: [["1", "Status", async () => { executions += 1; }]],
  });

  assert.equal(result, "quit");
  assert.equal(executions, 1);
});

test("invalid acknowledgement repeats only the acknowledgement prompt", async () => {
  const prompts = ["1", "x", "", "q"];
  const seen = [];
  let executions = 0;
  await runInteractiveMenu({
    prompt: async (question) => { seen.push(question); return prompts.shift(); },
    log: () => {},
    warn: () => {},
    menuItems: [["1", "Status", async () => { executions += 1; }]],
  });

  assert.equal(executions, 1);
  assert.deepEqual(seen, [
    "Choose an option",
    "Press Enter to return to the main menu, or q to quit",
    "Press Enter to return to the main menu, or q to quit",
    "Choose an option",
  ]);
});

test("interactive menu acknowledges an operation error without running it again", async () => {
  const prompts = ["1", "", "q"];
  let executions = 0;
  const warnings = [];
  const result = await runInteractiveMenu({
    prompt: async () => prompts.shift(),
    log: () => {},
    warn: (message) => warnings.push(message),
    menuItems: [["1", "Status", async () => { executions += 1; throw new Error("Status failed"); }]],
  });

  assert.equal(result, "quit");
  assert.equal(executions, 1);
  assert.deepEqual(warnings, ["Status failed"]);
});

test("interactive menu rejects duplicate shortcuts before executing a command", async () => {
  let executions = 0;
  await assert.rejects(
    runInteractiveMenu({
      prompt: async () => "1",
      log: () => {},
      warn: () => {},
      menuItems: [
        ["1", "Status", async () => { executions += 1; }],
        ["1", "Start", async () => { executions += 1; }],
      ],
    }),
    /duplicate shortcut: 1/i
  );
  assert.equal(executions, 0);
});

test("named JSON command never renders the interactive acknowledgement prompt", () => {
  const r = run(["help", "--json"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.doesNotMatch(r.stdout + r.stderr, /Press Enter to return to the main menu/i);
});

test("the Setup gateway returns one safe JSON envelope for core command success and failure", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-json-gateway-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "DATABASE_URL=postgres://archive:topsecret@example.test/archive\nPOSTGRES_PASSWORD=never-print-this\n");

  for (const [command, expectedCode, expectedStatus] of [
    ["help", "HELP_COMPLETED", 0],
    ["config", "CONFIG_COMPLETED", 0],
    ["status", "STATUS_FAILED", 1],
    ["start", "START_FAILED", 1],
    ["stop", "STOP_FAILED", 1],
    ["restart", "RESTART_FAILED", 1],
    ["health", "HEALTH_FAILED", 1],
    ["logs", "LOGS_FAILED", 1],
    ["migrate-status", "MIGRATE_STATUS_FAILED", 1],
    ["diagnostics", "DIAGNOSTICS_FAILED", 1],
  ]) {
    const r = run([command, "--json"], {
      ARCHIVE_ENV_PATH: envFile,
      ARCHIVE_INSTALLATION_MANIFEST_PATH: join(dir, "missing-manifest.json"),
      PATH: "", Path: "",
    });
    assert.equal(r.status, expectedStatus, `${command}: ${r.stderr} ${r.stdout}`);
    const result = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
    assert.equal(result.code, expectedCode);
    assert.equal(result.details.command, command);
    assert.ok(!`${r.stdout}${r.stderr}`.includes("topsecret"), `${command} must not disclose credential URLs`);
    assert.ok(!`${r.stdout}${r.stderr}`.includes("never-print-this"), `${command} must not disclose secrets`);
  }

  const unknown = run(["not-a-command", "--json"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(unknown.status, 1);
  assert.deepEqual(JSON.parse(unknown.stdout), {
    ok: false,
    code: "UNKNOWN_COMMAND",
    message: "Unknown setup command.",
    details: { command: "not-a-command" },
    nextActions: ["Run setup help to view supported commands."],
  });
  const maliciousUnknown = run(["bad?token=do-not-echo", "--json"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(maliciousUnknown.status, 1);
  assert.equal(JSON.parse(maliciousUnknown.stdout).details.command, "invalid");
  assert.ok(!`${maliciousUnknown.stdout}${maliciousUnknown.stderr}`.includes("do-not-echo"));

  const doctor = run(["doctor", "--mode=native", "--platform=linux-native", "--json"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(doctor.status, 0, doctor.stderr + doctor.stdout);
  assert.equal(JSON.parse(doctor.stdout).code, "DOCTOR_COMPLETED");

  for (const command of ["rotate-secrets", "migrate"]) {
    const r = run([command, "--json"], { ARCHIVE_ENV_PATH: envFile });
    assert.equal(r.status, 1);
    const result = JSON.parse(r.stdout);
    assert.equal(result.code, "CONFIRMATION_REQUIRED");
    assert.equal(result.details.command, command);
  }
  assert.match(readFileSync(envFile, "utf8"), /never-print-this/, "confirmation must prevent rotation writes");
  const confirmedMigrate = run(["migrate", "--yes", "--json"], {
    ARCHIVE_ENV_PATH: envFile,
    ARCHIVE_INSTALLATION_MANIFEST_PATH: join(dir, "missing-manifest.json"),
  });
  assert.equal(confirmedMigrate.status, 1);
  assert.equal(JSON.parse(confirmedMigrate.stdout).code, "MIGRATE_FAILED");

  writeFileSync(envFile, "REVERB_APP_KEY=old-key\nREVERB_APP_SECRET=old-secret\n");
  const confirmedRotation = run(["rotate-secrets", "--yes", "--json"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(confirmedRotation.status, 0, confirmedRotation.stderr + confirmedRotation.stdout);
  assert.equal(JSON.parse(confirmedRotation.stdout).code, "ROTATE_SECRETS_COMPLETED");
  const rotated = readFileSync(envFile, "utf8");
  assert.doesNotMatch(rotated, /old-key|old-secret/);
  assert.doesNotMatch(`${confirmedRotation.stdout}${confirmedRotation.stderr}`, /old-key|old-secret/);
});

test("support-bundle CLI returns a redacted JSON failure when secure Windows ACLs cannot be applied", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-support-bundle-"));
  const outputDir = join(dir, "bundles");
  const envFile = join(dir, ".env");
  writeFileSync(envFile, [
    "DATABASE_URL=postgres://archive:topsecret@example.test/archive",
    "POSTGRES_PASSWORD=never-print-this",
    "EXTERNAL_TOKEN=token-value",
    "HEALTH_URL=http://127.0.0.1:9/api/health",
    "",
  ].join("\n"));

  const r = run(["support-bundle", "--json"], {
    ARCHIVE_ENV_PATH: envFile,
    ARCHIVE_SUPPORT_BUNDLE_DIR: outputDir,
    ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1",
    PATH: "", Path: "",
  });
  assert.equal(r.status, 1, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  assert.equal(result.code, "SUPPORT_BUNDLE_FAILED");
  assert.equal(readdirSync(outputDir).length, 0, "the unsafe bundle must be removed after ACL failure");
  for (const secret of ["topsecret", "never-print-this", "token-value", "example.test"]) {
    assert.ok(!`${r.stdout}${r.stderr}`.includes(secret), `support output must redact ${secret}`);
  }
});

test("Control Center entry point composes focused modules", () => {
  const modules = ["cli.mjs", "configuration.mjs", "docker-compose.mjs", "operations.mjs", "runtime-adapter.mjs"];
  for (const file of modules) {
    assert.equal(existsSync(join(ROOT, "scripts", "control-center", file)), true, `missing focused Control Center module: ${file}`);
  }
  const entry = readFileSync(join(ROOT, "scripts", "control-center.mjs"), "utf8");
  assert.match(entry, /\.\/control-center\/cli\.mjs/);
  assert.match(entry, /createConsoleUi/);
  assert.match(entry, /\.\/control-center\/configuration\.mjs/);
  assert.match(entry, /\.\/control-center\/docker-compose\.mjs/);
  assert.match(entry, /\.\/control-center\/operations\.mjs/);
  assert.doesNotMatch(entry, /createInterface/);
  assert.doesNotMatch(entry, /function printBanner\(/);
  assert.doesNotMatch(entry, /function printMenu\(/);
});

test("server commands require a recorded release before Docker access", () => {
  const r = run(["status"], { ARCHIVE_COMPOSE_PROFILES: "ocr", PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /No release installation manifest/i);
});

test("setup plan validates a declarative configuration deterministically without Docker or writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-plan-"));
  const configFile = join(dir, "setup.json");
  const envFile = join(dir, ".env");
  const config = {
    schemaVersion: "1.0",
    mode: "docker",
    platform: "linux-docker",
    source: "offline",
    intent: "fresh",
    access: "local",
    runtimeProfiles: ["core", "media"],
    capabilities: ["ocr", "observability"],
    dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
    storage: { driver: "local", path: "/srv/archive-suite/storage" },
  };
  writeFileSync(configFile, JSON.stringify(config));

  const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, true);
  assert.equal(result.code, "PLAN_READY");
  assert.deepEqual(result.details.configuration.runtimeProfiles, ["core", "media"]);
  assert.equal(existsSync(envFile), false, "plan must not create .env");

  const imported = run(["import-config", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(imported.status, 0, imported.stderr + imported.stdout);
  assert.deepEqual(JSON.parse(imported.stdout).details, result.details.configuration);
  assert.equal(existsSync(envFile), false, "import-config must not create .env");
});

test("special setup JSON commands redact credential-bearing validation errors", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-special-json-redaction-"));
  const configFile = join(dir, "setup.json");
  writeFileSync(configFile, JSON.stringify(validSetupConfig({
    platform: "https://archive:topsecret@example.test/runtime",
  })));

  for (const command of ["plan", "import-config", "install", "wizard"]) {
    const r = run([command, `--config=${configFile}`, "--json"], {
      ARCHIVE_ENV_PATH: join(dir, ".env"),
      ARCHIVE_INSTALLATION_MANIFEST_PATH: join(dir, "installation-manifest.json"),
      PATH: "", Path: "",
    });
    assert.notEqual(r.status, 0, `${command} must reject the invalid configuration`);
    const result = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
    for (const secret of ["topsecret", "example.test"]) {
      assert.ok(!`${r.stdout}${r.stderr}`.includes(secret), `${command} must not disclose ${secret}`);
    }
  }
});

test("wizard config mode has parity with the non-interactive plan for every supported choice family", () => {
  const cases = [
    { runtimeProfiles: ["core"], source: "online", access: "local", storage: "/srv/archive-suite/local" },
    { runtimeProfiles: ["core", "media"], source: "offline", access: "intranet", storage: "/srv/archive-suite/media" },
    { runtimeProfiles: ["core", "edge"], source: "online", access: "public", storage: "/srv/archive-suite/edge" },
    { runtimeProfiles: ["core", "media", "edge"], source: "offline", access: "public", storage: "/srv/archive-suite/full" },
  ];

  for (const [index, choice] of cases.entries()) {
    const dir = mkdtempSync(join(tmpdir(), `cc-wizard-parity-${index}-`));
    const configFile = join(dir, "setup.json");
    const envFile = join(dir, ".env");
    const manifestFile = join(dir, "installation-manifest.json");
    writeFileSync(configFile, JSON.stringify(validSetupConfig({
      ...choice,
      storage: { driver: "local", path: choice.storage },
    })));
    const env = { ARCHIVE_ENV_PATH: envFile, ARCHIVE_INSTALLATION_MANIFEST_PATH: manifestFile, PATH: "", Path: "" };

    const planned = run(["plan", `--config=${configFile}`, "--json"], env);
    const wizard = run(["wizard", `--config=${configFile}`, "--json"], env);
    assert.equal(wizard.status, 0, wizard.stderr + wizard.stdout);
    assert.deepEqual(JSON.parse(wizard.stdout), JSON.parse(planned.stdout), `wizard parity case ${index}`);
    assert.equal(existsSync(envFile), false, "wizard validation must not create .env");
    assert.equal(existsSync(manifestFile), false, "wizard validation must not create a manifest");
  }
});

test("wizard config mode keeps a planned native choice read-only before execution", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-wizard-invalid-"));
  const configFile = join(dir, "setup.json");
  const envFile = join(dir, ".env");
  writeFileSync(configFile, JSON.stringify(validSetupConfig({ mode: "native", platform: "linux-native" })));

  const r = run(["wizard", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  assert.equal(result.code, "PLAN_READY");
  assert.match(JSON.stringify(result.nextActions), /install/i);
  assert.equal(existsSync(envFile), false, "planned native selection must not write .env");
});

test("wizard answers use the declarative planner resolver rather than a second selection rule", () => {
  const setup = createSetupConfiguration({ loadPlatformContract });
  const answers = validSetupConfig({
    source: "offline",
    access: "public",
    runtimeProfiles: ["core", "media", "edge"],
    capabilities: ["ocr", "observability"],
    storage: { driver: "local", path: "/srv/archive-suite/wizard" },
  });
  const planned = setup.planInput(answers);
  assert.equal(planned.ok, true);
  assert.deepEqual(planned.details.configuration, answers);
});

test("controlled wizard prompts create the same candidate accepted by the declarative planner", async () => {
  const setup = createSetupConfiguration({ loadPlatformContract });
  const prompts = [];
  const answers = ["docker", "linux-docker", "offline", "public", "/srv/archive-suite/interactive", "media,edge", "ocr,observability"];
  const choices = await collectWizardRuntimeChoices({
    ask: async (prompt, fallback) => { prompts.push(prompt); return answers.shift() || fallback; },
    existing: {},
    contract: loadPlatformContract(),
    platformId: "linux-docker",
  });
  const planned = setup.planInput(choices.candidate);
  assert.equal(planned.ok, true);
  assert.deepEqual(planned.details.configuration, validSetupConfig({
    source: "offline", access: "public", runtimeProfiles: ["core", "media", "edge"],
    capabilities: ["ocr", "observability"], storage: { driver: "local", path: "/srv/archive-suite/interactive" },
  }));
  assert.equal(prompts.length, 7);
  // Setup's terminal output is English-only: Arabic mojibakes in common
  // Windows terminal codepages, so every prompt must be plain ASCII-range text.
  assert.ok(prompts.every((prompt) => !/[\u0600-\u06FF]/.test(prompt)), "runtime choice prompts must be English, not Arabic (terminal mojibake)");
});

test("wizard accepts flexible named, numbered, and aliased option choices with English help", async () => {
  const prompts = [];
  const notices = [];
  const answers = ["docker", "linux-docker", "offline", "public", "/srv/archive-suite/flexible", "Media + TLS", "ocr, 3"];
  const choices = await collectWizardRuntimeChoices({
    ask: async (prompt, fallback) => { prompts.push(prompt); return answers.shift() || fallback; },
    log: (message) => notices.push(message),
    existing: {},
    contract: loadPlatformContract(),
    platformId: "linux-docker",
  });
  assert.deepEqual(choices.candidate.runtimeProfiles, ["core", "media", "edge"]);
  assert.deepEqual(choices.candidate.capabilities, ["ocr", "observability"]);
  assert.ok(notices.some((message) => /Enter names or numbers/i.test(message)));
  assert.ok([...prompts, ...notices].every((text) => !/[\u0600-\u06FF]/.test(text)), "wizard choice help must be English");
});

test("wizard profile numbers and aliases follow the core-implicit contract", async () => {
  const answers = ["docker", "linux-docker", "online", "public", "/srv/archive-suite/profiles", "2, 3", "none"];
  const numbered = await collectWizardRuntimeChoices({
    ask: async (_prompt, fallback) => answers.shift() || fallback,
    existing: {}, contract: loadPlatformContract(), platformId: "linux-docker",
  });
  assert.deepEqual(numbered.candidate.runtimeProfiles, ["core", "media", "edge"]);

  const aliasAnswers = ["docker", "linux-docker", "online", "public", "/srv/archive-suite/profiles", "ocr, public", "none"];
  const aliased = await collectWizardRuntimeChoices({
    ask: async (_prompt, fallback) => aliasAnswers.shift() || fallback,
    existing: {}, contract: loadPlatformContract(), platformId: "linux-docker",
  });
  assert.deepEqual(aliased.candidate.runtimeProfiles, ["core", "media", "edge"]);
});

test("wizard confirmation requires confirm and never provisions after back or q", async () => {
  for (const [answer, expected] of [["back", "back"], ["q", "quit"], ["confirm", "confirm"]]) {
    let provisions = 0;
    const decision = await requestWizardConfirmation({ ask: async () => answer, log: () => {} });
    if (decision === "confirm") provisions += 1;
    assert.equal(decision, expected);
    assert.equal(provisions, expected === "confirm" ? 1 : 0);
  }
  const answers = ["", "q"];
  const blankDecision = await requestWizardConfirmation({
    ask: async (_prompt, fallback) => {
      const answer = answers.shift();
      return answer || fallback;
    },
    log: () => {},
  });
  assert.equal(blankDecision, "quit", "an empty confirmation must not use confirm as a default");
});

test("guided setup uses the explicit confirmation gate before it can provision", () => {
  const controlCenter = readFileSync(join(ROOT, "scripts/control-center.mjs"), "utf8");
  assert.match(controlCenter, /requestWizardConfirmation\(\{ ask, log \}\)/);
  assert.match(controlCenter, /if \(confirmation !== "confirm"\) \{[\s\S]*return/);
  assert.match(controlCenter, /Your setup summary/);
  assert.doesNotMatch(controlCenter, /Choice summary/);
  assert.doesNotMatch(controlCenter, /confirm\("Save this configuration and install the signed release\?", "y"\)/);
});

for (const [name, overrides, code] of [
  ["public access without edge", { access: "public", runtimeProfiles: ["core"] }, "PUBLIC_ACCESS_REQUIRES_EDGE"],
  ["edge outside public access", { access: "intranet", runtimeProfiles: ["core", "edge"] }, "EDGE_REQUIRES_PUBLIC_ACCESS"],
]) {
  test(`wizard config rejects ${name} before Docker or writes`, () => {
    const dir = mkdtempSync(join(tmpdir(), "cc-wizard-access-invalid-"));
    const configFile = join(dir, "setup.json");
    const envFile = join(dir, ".env");
    const manifestFile = join(dir, "installation-manifest.json");
    writeFileSync(configFile, JSON.stringify(validSetupConfig(overrides)));
    const r = run(["wizard", `--config=${configFile}`, "--json"], {
      ARCHIVE_ENV_PATH: envFile, ARCHIVE_INSTALLATION_MANIFEST_PATH: manifestFile, PATH: "", Path: "",
    });
    assert.notEqual(r.status, 0);
    const result = JSON.parse(r.stdout);
    assert.equal(result.code, code);
    assert.equal(existsSync(envFile), false);
    assert.equal(existsSync(manifestFile), false);
  });
}

test("setup plan rejects a platform that does not match its mode before writes", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-plan-invalid-"));
  const configFile = join(dir, "setup.json");
  const envFile = join(dir, ".env");
  writeFileSync(configFile, JSON.stringify(validSetupConfig({ platform: "linux-native" })));

  const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.match(result.message, /does not match mode/i);
  assert.equal(existsSync(envFile), false, "invalid input must fail before writing .env");
});

for (const [name, overrides, message] of [
  ["capability used as a runtime profile", { runtimeProfiles: ["core", "ocr"] }, /capability .*runtime profile/i],
  ["illegal runtime profile", { runtimeProfiles: ["core", "not-a-profile"] }, /illegal runtime profile/i],
  ["invalid source", { source: "remote" }, /source must be one of/i],
  ["storage URL with credentials", { storage: { driver: "local", path: "https://archive:topsecret@example.test/storage" } }, /storage\.path/i],
]) {
  test(`setup plan rejects ${name} before writes`, () => {
    const dir = mkdtempSync(join(tmpdir(), "cc-plan-invalid-"));
    const configFile = join(dir, "setup.json");
    const envFile = join(dir, ".env");
    writeFileSync(configFile, JSON.stringify(validSetupConfig(overrides)));

    const r = run(["plan", `--config=${configFile}`, "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
    assert.notEqual(r.status, 0);
    const result = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
    assert.equal(result.ok, false);
    assert.match(result.message, message);
    assert.ok(!r.stdout.includes("topsecret"), "failure output must not echo credentials");
    assert.equal(existsSync(envFile), false, "invalid input must fail before writing .env");
  });
}

test("setup export-config emits a safe canonical configuration or a clear absent result", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-"));
  const envFile = join(dir, ".env");
  let r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  assert.equal(JSON.parse(r.stdout).code, "CONFIG_NOT_FOUND");

  writeFileSync(envFile, "ARCHIVE_COMPOSE_PROFILES=media\nACCESS_MODE=local\nPOSTGRES_PASSWORD=never-export-this\nREDIS_URL=redis://:also-secret@redis:6379\n");
  r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const result = JSON.parse(r.stdout);
  const serialized = JSON.stringify(result);
  assert.equal(result.code, "CONFIG_EXPORTED");
  assert.ok(!serialized.includes("never-export-this"));
  assert.ok(!serialized.includes("also-secret"));
  assert.ok(!/password|token|secret|_url/i.test(JSON.stringify(result.details)));
});

test("setup export-config rejects a credential-bearing storage path without exposing it", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-sensitive-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "ARCHIVE_STORAGE_PATH=https://archive:topsecret@example.test/storage\n");

  const r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: envFile, PATH: "", Path: "" });
  assert.notEqual(r.status, 0);
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.match(result.message, /storage\.path/i);
  assert.ok(!r.stdout.includes("topsecret"));
  assert.ok(!r.stdout.includes("example.test"));
});

test("setup export-config returns structured JSON when the configured env path cannot be read", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-export-directory-"));
  const r = run(["export-config", "--json"], { ARCHIVE_ENV_PATH: dir, PATH: "", Path: "" });

  assert.notEqual(r.status, 0);
  assert.notEqual(r.stdout.trim(), "", "JSON failures must return a result object");
  const result = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(result), ["ok", "code", "message", "details", "nextActions"]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CONFIG_READ_FAILED");
  assert.equal(r.stderr, "", "JSON failures must not print a stack trace");
});

test("setup plan and import never create a manifest, while install and repair reuse one safe manifest", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-install-manifest-"));
  const configFile = join(dir, "setup.json");
  const manifestFile = join(dir, "installation-manifest.json");
  writeFileSync(configFile, JSON.stringify(validSetupConfig({ runtimeProfiles: ["core", "media"], capabilities: ["ocr"] })));
  const env = {
    ARCHIVE_ENV_PATH: join(dir, ".env"),
    ARCHIVE_INSTALLATION_MANIFEST_PATH: manifestFile,
    ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1",
    PATH: "", Path: "",
  };

  for (const command of ["plan", "import-config"]) {
    const result = run([command, `--config=${configFile}`, "--json"], env);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(existsSync(manifestFile), false, `${command} must not create a manifest`);
  }

  const installed = run(["install", `--config=${configFile}`, "--json"], env);
  assert.equal(installed.status, 0, installed.stderr + installed.stdout);
  const first = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.equal(first.operation.status, "succeeded");
  assert.ok(!JSON.stringify(first).match(/password|secret|token|credential|_url/i));
  assert.ok(first.artifacts.every((artifact) => /^sha256:[a-f0-9]{64}$/.test(artifact.digest || "")), "install manifest must record immutable release digests");
  assert.ok(first.services.includes("ocr") && !first.services.includes("caddy"), "only explicitly selected media service is added; edge remains disabled");

  const repaired = run(["repair", `--config=${configFile}`, "--json"], env);
  assert.equal(repaired.status, 0, repaired.stderr + repaired.stdout);
  const second = JSON.parse(readFileSync(manifestFile, "utf8"));
  assert.deepEqual(second.previousVersion, first.previousVersion);
  assert.deepEqual(second.lastSuccessfulStep, first.lastSuccessfulStep);
  assert.equal(second.operation.type, "repair");
  assert.equal(second.operation.status, "succeeded");
});

test("confirmed migration constructs archive:migrate-safe through the manifest-backed release runtime", async () => {
  const calls = [];
  const output = { titleLine: () => {}, log: () => {}, ok: () => {}, err: () => {} };
  const status = await applySafeMigration({
    adapter: { exec: (args) => { calls.push(args); return { status: 0 }; } },
    confirmed: true,
    output,
    confirm: async () => { throw new Error("--yes must not prompt"); },
  });
  assert.equal(status, 0);
  assert.deepEqual(calls, [["php", "artisan", "archive:migrate-safe"]]);

  const entry = readFileSync(join(ROOT, "scripts/control-center.mjs"), "utf8");
  assert.match(entry, /function releaseMigrateDeploy[\s\S]*applySafeMigration\(\{ adapter: releaseRuntimeForLifecycle\(\)/);
  assert.match(entry, /migrate: \(\) => releaseMigrateDeploy\(\{ confirmed: hasFlag\("yes"\) \}\)/);
  assert.doesNotMatch(entry, /migrate: \(\) => developmentMigrateDeploy/);
});

test("user release Compose never builds locally while the explicit development Compose remains source-built", () => {
  const release = readFileSync(join(ROOT, "infra/docker-compose.release.yml"), "utf8");
  const development = readFileSync(join(ROOT, "infra/docker-compose.yml"), "utf8");
  assert.doesNotMatch(release, /^\s*build:/m);
  assert.match(release, /pull_policy: \$\{ARCHIVE_RELEASE_PULL_POLICY:-missing\}/);
  assert.match(development, /^\s*build:/m);
  assert.doesNotMatch(readFileSync(join(ROOT, "scripts/control-center/runtime-adapter.mjs"), "utf8"), /compose\(\["up", "-d", "--build"\]\)/);
  assert.match(release, /laravel-fpm:[\s\S]*archive:migrate-safe/);
  assert.match(release, /next:[\s\S]*ARCHIVE_API_BASE_URL/);
  assert.match(release, /ocr:[\s\S]*ARCHIVE_RELEASE_IMAGE_OCR:-/);
  assert.match(release, /caddy:[\s\S]*ARCHIVE_RELEASE_IMAGE_CADDY:-/);
  const entry = readFileSync(join(ROOT, "scripts/control-center.mjs"), "utf8");
  for (const command of ["status", "start", "stop", "restart", "logs", "health", "exec"]) assert.match(entry, new RegExp(`lifecycle\\(\\"${command}\\"`));
});

test("first-run guide renders quick and advanced setup paths without deploying", () => {
  const r = run(["first-run"], { ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1" });
  assert.equal(r.status, 0);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /First run/);
  assert.match(clean, /Quick preset/);
  assert.match(clean, /setup quick/);
  assert.match(clean, /Advanced preset/);
  assert.match(clean, /setup deploy/);
  assert.doesNotMatch(clean, /docker compose up/);
});

test("config prints known keys and masks secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    "ACCESS_MODE=internal\nPORT=8787 # local port\nADMIN_USERNAME=admin\nAI_PROVIDER= # provider comment\nDATABASE_URL=postgres://u:topsecret@h:5432/db\n"
  );
  const r = run(["config"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ACCESS_MODE/);
  assert.match(r.stdout, /admin/);
  assert.ok(!r.stdout.includes("local port"), "inline comments must not be treated as env values");
  assert.ok(!r.stdout.includes("provider comment"), "empty values with comments must remain empty");
  assert.ok(!r.stdout.includes("topsecret"), "DATABASE_URL must be masked, not shown in full");
});

test("config without an .env guides the operator to deploy", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const r = run(["config"], { ARCHIVE_ENV_PATH: join(dir, "missing.env") });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No .env yet/);
});

test("backups command renders without throwing when the Laravel container is unreachable", () => {
  // V1-208H: backups now list via `php artisan archive:backup-list --json`
  // inside the laravel container (BackupService), not local .sql files, so
  // this environment (no stack running) legitimately reports a failure —
  // the guarantee this test checks is that the CLI degrades gracefully
  // (prints the section header, exits with a defined status) rather than
  // throwing an uncaught exception.
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const r = run(["backups"], { ARCHIVE_ENV_PATH: join(dir, ".env") });
  assert.equal(typeof r.status, "number");
  assert.match(r.stdout, /Backups/);
});

test("verify-backup command is wired and renders without throwing when the Laravel container is unreachable", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const r = run(["verify-backup", "--name=backup-x.json.gz"], { ARCHIVE_ENV_PATH: join(dir, ".env") });
  assert.equal(typeof r.status, "number");
  assert.match(r.stdout, /Verify a backup/);
});

test("health exits non-zero without a recorded release", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "HEALTH_URL=http://127.0.0.1:9/api/health\n");
  const r = run(["health"], { ARCHIVE_ENV_PATH: envFile });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /No release installation manifest/i);
});

test("doctor uses the Windows-safe pnpm invocation and reports the environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "PORT=9\n");
  const r = run(["doctor"], { ARCHIVE_ENV_PATH: envFile });
  const out = r.stderr + r.stdout;
  assert.match(out, /Doctor/);
  assert.doesNotMatch(out, /pnpm not found/);
});

test("doctor filters the platform contract and keeps native deployment explicitly planned", () => {
  const r = run(["doctor", "--mode=native", "--platform=linux-native"]);
  const out = r.stderr + r.stdout;
  assert.equal(r.status, 0, out);
  assert.match(out, /Platform compatibility contract v1\.0/);
  assert.match(out, /Linux Native \(linux-native\) — planned/);
  assert.match(out, /Native deployment is planned: no install or start action is available yet\./);
  assert.match(out, /Read-only report/);
  assert.doesNotMatch(out, /docker compose up/);
});

test("doctor rejects an unknown platform without performing deployment", () => {
  const r = run(["doctor", "--platform=not-a-platform"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /Unknown platform/);
  assert.doesNotMatch(r.stderr + r.stdout, /docker compose up/);
});

test("deploy replaces every duplicate ADMIN_PASSWORD placeholder with the generated password", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "POSTGRES_PASSWORD=CHANGE_ME_POSTGRES_PASSWORD",
      "REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD",
      "REVERB_APP_ID=archive-collab",
      "REVERB_APP_KEY=archive-collab-key",
      "REVERB_APP_SECRET=CHANGE_ME_REVERB_SECRET_48_CHARS_MINIMUM",
      "LARAVEL_APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      "ADMIN_EMAIL=admin@example.com",
      "ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD",
      "DATABASE_URL=postgresql://archive:CHANGE_ME_POSTGRES_PASSWORD@postgres:5432/archive",
      "ADMIN_USERNAME=admin",
      "ADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD",
      "",
    ].join("\n")
  );

  const r = run(["deploy"], { ARCHIVE_ENV_PATH: envFile, ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1", ARCHIVE_DEVELOPMENT_MODE: "1" });
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  const matches = [...content.matchAll(/^ADMIN_PASSWORD=(.+)$/gm)].map((m) => m[1]);
  assert.equal(matches.length, 2);
  assert.equal(new Set(matches).size, 1, "duplicate ADMIN_PASSWORD entries must stay in sync");
  assert.doesNotMatch(content, /CHANGE_ME_(ADMIN|STRONG)_PASSWORD/);
});

test("generate-password prints a strong password without requiring .env", () => {
  const r = run(["generate-password"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const match = clean.match(/Generated password:\s+(\S+)/);
  assert.ok(match, "generated password should be visible once");
  assert.ok(match[1].length >= 20, "generated password should be long enough for first-login use");
});

test("change-admin-password updates duplicate ADMIN_PASSWORD values and admin email", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "ADMIN_EMAIL=old@example.test",
      "ADMIN_PASSWORD=old-password-one",
      "POSTGRES_PASSWORD=postgres-secret",
      "ADMIN_PASSWORD=old-password-two",
      "",
    ].join("\n")
  );

  const r = run(
    ["change-admin-password", "--email=owner@example.test", "--password=New-Strong-Password-123", "--env-only"],
    { ARCHIVE_ENV_PATH: envFile }
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  assert.match(content, /^ADMIN_EMAIL=owner@example\.test$/m);
  const matches = [...content.matchAll(/^ADMIN_PASSWORD=(.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(matches, ["New-Strong-Password-123", "New-Strong-Password-123"]);
  assert.match(r.stdout, /Updated ADMIN_EMAIL, ADMIN_PASSWORD/);
  assert.match(r.stdout, /Skipped live Laravel update/);
});

test("change-admin-password can generate and store a replacement password", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "ADMIN_EMAIL=admin@example.test\nADMIN_PASSWORD=CHANGE_ME_STRONG_PASSWORD\n");

  const r = run(["change-admin-password", "--generate", "--env-only"], { ARCHIVE_ENV_PATH: envFile });
  assert.equal(r.status, 0, r.stderr + r.stdout);

  const content = readFileSync(envFile, "utf8");
  const password = content.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1] || "";
  assert.ok(password.length >= 20);
  assert.notEqual(password, "CHANGE_ME_STRONG_PASSWORD");
  assert.match(r.stdout, /Generated admin password:/);
});

test("wizard without a TTY falls back to deploy and still provisions secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  const envFile = join(dir, ".env");
  writeFileSync(
    envFile,
    [
      "POSTGRES_PASSWORD=CHANGE_ME_POSTGRES_PASSWORD",
      "REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD",
      "ADMIN_EMAIL=admin@example.com",
      "ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD",
      "",
    ].join("\n")
  );

  const r = run(["wizard"], { ARCHIVE_ENV_PATH: envFile, ARCHIVE_CONTROL_CENTER_SKIP_DOCKER: "1", ARCHIVE_DEVELOPMENT_MODE: "1" });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /No interactive terminal detected/);

  const content = readFileSync(envFile, "utf8");
  assert.doesNotMatch(content, /CHANGE_ME_POSTGRES_PASSWORD/);
  assert.doesNotMatch(content, /CHANGE_ME_ADMIN_PASSWORD/);
});

test("help lists the wizard as the recommended first-run path", () => {
  const r = run(["help"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const clean = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /setup wizard/);
  assert.match(clean, /Guided setup \(wizard/);
});
