import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export function createHealthProbe({ readEnv, defaultHealthUrl, output }) {
  return async () => {
    output.titleLine("Health check");
    const url = defaultHealthUrl(readEnv());
    output.log(`GET ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      (response.ok ? output.ok : output.warn)(`HTTP ${response.status}. ${body.slice(0, 200)}`);
      return { status: response.ok ? 0 : 1 };
    } catch (error) {
      output.err(`No response from ${url} — is the stack running? (${error.name})`);
      return { status: 1 };
    }
  };
}

export async function applySafeMigration({ adapter, confirmed = false, output, confirm }) {
  output.titleLine("Apply pending migrations (php artisan archive:migrate-safe)");
  output.log("Preflight-checked: backs up the database first, runs in a maintenance window, and exits cleanly if nothing is pending.");
  if (!confirmed && !(await confirm("Apply all pending migrations to the configured database?"))) { output.log("Cancelled."); return 0; }
  const result = adapter.exec(["php", "artisan", "archive:migrate-safe"]);
  const status = result.status ?? 1;
  (status === 0 ? output.ok : output.err)(status === 0 ? "Migrations applied." : "Migration failed — application left in maintenance mode. See command output above for rollback steps.");
  return status;
}

// V1-208H: backups now go through BackupService's legal DB+files+manifest+
// checksums archive (see archive-laravel BackupRunCommand/BackupListCommand/
// BackupVerifyCommand/BackupRestoreCommand), not raw pg_dump/psql — Setup's
// CLI has no HTTP session, so it drives those `php artisan archive:backup-*
// --json` commands through the same adapter.exec() the migrate commands use
// (defaults to the laravel container, not postgres) and parses their single
// JSON stdout line. A command that can't be reached at all (stack down,
// unparsable output) degrades to a structured failure instead of throwing.
function runBackupCommand(adapter, commandArgs) {
  const result = adapter.exec(["php", "artisan", ...commandArgs, "--json"], { inherit: false });
  const raw = (result.stdout || "").trim();
  const lastLine = raw.split("\n").filter(Boolean).pop() || "";
  try {
    return JSON.parse(lastLine);
  } catch {
    const detail = (result.stderr || raw || `exit ${result.status ?? 1}`).slice(0, 300);
    return { ok: false, code: "BACKUP_COMMAND_UNREACHABLE", message: `Could not reach "php artisan ${commandArgs[0]}" — is the stack running? ${detail}`, details: {} };
  }
}

export function createControlOperations({ adapter, composeFile, output, ask, confirm, runPnpm, root }) {
  const commandStatus = (result) => result.status ?? 1;
  const listBackupFiles = () => {
    const payload = runBackupCommand(adapter, ["archive:backup-list"]);
    return payload.ok ? (payload.details?.backups ?? []) : [];
  };

  const serverStatus = () => {
    output.titleLine("Server status");
    if (!existsSync(composeFile)) { output.warn("No compose file yet — run Deploy first."); return 1; }
    return commandStatus(adapter.status());
  };
  const serverStart = () => {
    output.titleLine("Starting (docker compose up -d)");
    const status = commandStatus(adapter.start());
    (status === 0 ? output.ok : output.err)(status === 0 ? "Stack started." : `Docker compose start failed (exit ${status}).`);
    return status;
  };
  const serverStop = () => {
    output.titleLine("Stopping (docker compose down)");
    const status = commandStatus(adapter.stop());
    (status === 0 ? output.ok : output.err)(status === 0 ? "Stack stopped." : `Docker compose stop failed (exit ${status}).`);
    return status;
  };
  const serverRestart = () => {
    output.titleLine("Restarting (docker compose restart)");
    const status = commandStatus(adapter.restart());
    (status === 0 ? output.ok : output.err)(status === 0 ? "Stack restarted." : `Docker compose restart failed (exit ${status}).`);
    return status;
  };
  const serverLogs = ({ follow = false } = {}) => {
    output.titleLine(`Service logs (last 200 lines)${follow ? " — following, Ctrl+C to stop" : ""}`);
    return commandStatus(adapter.logs({ follow }));
  };
  const healthCheck = async () => commandStatus(await adapter.health());

  const migrateStatus = () => {
    output.titleLine("Database migration status (php artisan migrate:status)");
    return commandStatus(adapter.exec(["php", "artisan", "migrate:status"]));
  };
  const migrateDeploy = ({ confirmed = false } = {}) => applySafeMigration({ adapter, confirmed, output, confirm });
  const seedDemoData = async () => {
    output.titleLine("Seed demo archive data (php artisan db:seed --class=DemoArchiveSeeder)");
    output.log("Adds sample archive records with content types, sections, and classifications.");
    output.log("Idempotent — safe to re-run; never duplicates existing demo rows.");
    if (!(await confirm("Insert demo archive content into the configured database?"))) { output.log("Cancelled."); return 0; }
    const status = commandStatus(adapter.exec(["php", "artisan", "db:seed", "--class=DemoArchiveSeeder", "--force"]));
    (status === 0 ? output.ok : output.err)(status === 0 ? "Demo archive data seeded — open /archive to see it." : `Seeding failed (exit ${status}). Is the stack running? Try Server: start.`);
    return status;
  };

  const backupNow = () => {
    output.titleLine("Backup — full legal backup (DB + files + manifest + checksums)");
    const payload = runBackupCommand(adapter, ["archive:backup-run"]);
    (payload.ok ? output.ok : output.err)(payload.message);
    if (payload.ok && payload.details?.backup) {
      output.log(`Backup: ${payload.details.backup.name} (${payload.details.backup.sizeBytes} bytes, checksum ${payload.details.backup.checksum?.slice(0, 12)}…)`);
    }
    return payload.ok ? 0 : 1;
  };
  const listBackups = () => {
    output.titleLine("Backups (legal DB + files + manifest, via BackupService)");
    const payload = runBackupCommand(adapter, ["archive:backup-list"]);
    if (!payload.ok) { output.err(payload.message); return 1; }
    const backups = payload.details?.backups ?? [];
    if (!backups.length) { output.log("No backups yet."); return 0; }
    backups.forEach((backup, index) => output.log(`${String(index + 1).padStart(2)}) ${backup.name}  (${backup.createdAt}, ${backup.checksum ? "checksum on file" : "no checksum"})`));
    return 0;
  };
  const restoreBackup = async () => {
    output.titleLine("Restore a backup");
    const listPayload = runBackupCommand(adapter, ["archive:backup-list"]);
    if (!listPayload.ok) { output.err(listPayload.message); return 1; }
    const backups = listPayload.details?.backups ?? [];
    if (!backups.length) { output.warn("No backups to restore."); return 0; }
    backups.forEach((backup, index) => output.log(`${String(index + 1).padStart(2)}) ${backup.name}`));
    const selected = backups[Number(await ask("Restore which backup number")) - 1];
    if (!selected) { output.log("Cancelled."); return 0; }
    output.warn(`This OVERWRITES the current database with ${selected.name}. This cannot be undone.`);
    if (!(await confirm("Type y to proceed with the destructive restore"))) { output.log("Cancelled."); return 0; }
    // archive:backup-restore itself refuses a checksum-mismatched backup
    // before touching any live data (BackupService::restore()) — this call
    // doesn't re-check that, it just surfaces the command's verdict.
    const payload = runBackupCommand(adapter, ["archive:backup-restore", selected.name, "--force"]);
    (payload.ok ? output.ok : output.err)(payload.message);
    // A legacy backup with no .sha256 sidecar restores successfully but
    // unverified (BackupService.restore() only hard-blocks a sidecar that's
    // present and mismatched) — surface that so a green "Restore complete"
    // doesn't read as "integrity confirmed" when it wasn't checked.
    if (payload.ok && payload.details?.result?.verified === false) {
      output.warn("Integrity was not verified for this backup (no checksum sidecar) — restored anyway, but unconfirmed.");
    }
    return payload.ok ? 0 : 1;
  };
  const verifyBackup = async ({ name } = {}) => {
    output.titleLine("Verify a backup's checksum");
    let target = name;
    if (!target) {
      const listPayload = runBackupCommand(adapter, ["archive:backup-list"]);
      if (!listPayload.ok) { output.err(listPayload.message); return 1; }
      const backups = listPayload.details?.backups ?? [];
      if (!backups.length) { output.warn("No backups to verify."); return 0; }
      backups.forEach((backup, index) => output.log(`${String(index + 1).padStart(2)}) ${backup.name}`));
      const selected = backups[Number(await ask("Verify which backup number")) - 1];
      if (!selected) { output.log("Cancelled."); return 0; }
      target = selected.name;
    }
    const payload = runBackupCommand(adapter, ["archive:backup-verify", target]);
    (payload.ok ? output.ok : output.err)(payload.message);
    return payload.ok ? 0 : 1;
  };

  const runDiagnostics = ({ quiet = false } = {}) => {
    output.titleLine("Diagnostics — canonical verify gate (pnpm verify)");
    const result = runPnpm(["run", "verify"], root, { stdio: quiet ? "pipe" : "inherit" });
    (result.status === 0 ? output.ok : output.err)(`verify ${result.status === 0 ? "passed" : `exit ${result.status}`}`);
    return result.status ?? 1;
  };
  const updateAndRebuild = async () => {
    output.titleLine("Update & rebuild");
    output.warn("Runs: git pull → pnpm install --frozen-lockfile → pnpm build → docker compose up -d --build.");
    output.log("(Migrations run automatically inside the laravel container on start.)");
    if (!(await confirm("Proceed?"))) { output.log("Cancelled."); return 0; }
    const steps = [
      ["git pull", () => spawnSync("git", ["pull", "--ff-only"], { cwd: root, stdio: "inherit" })],
      ["pnpm install --frozen-lockfile", () => runPnpm(["install", "--frozen-lockfile"])],
      ["build", () => runPnpm(["run", "build"])],
      ["rebuild containers", () => adapter.install()],
    ];
    for (const [name, step] of steps) {
      output.log(`\n-> ${name}`);
      const result = step();
      const status = commandStatus(result);
      if (status !== 0) { output.err(`Step "${name}" failed (exit ${status}). Stopping.`); return status; }
    }
    output.ok("Update complete.");
    return 0;
  };
  return { serverStatus, serverStart, serverStop, serverRestart, serverLogs, healthCheck, migrateStatus, migrateDeploy, seedDemoData, listBackupFiles, backupNow, listBackups, restoreBackup, verifyBackup, runDiagnostics, updateAndRebuild };
}
