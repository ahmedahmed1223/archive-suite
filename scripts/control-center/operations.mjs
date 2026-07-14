import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

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

export function createControlOperations({ adapter, composeFile, backupDir, readEnv, output, ask, confirm, runPnpm, root }) {
  const commandStatus = (result) => result.status ?? 1;
  const listBackupFiles = () => !existsSync(backupDir) ? [] : readdirSync(backupDir).filter((file) => file.endsWith(".sql")).sort().reverse();

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
  const migrateDeploy = async ({ confirmed = false } = {}) => {
    output.titleLine("Apply pending migrations (php artisan archive:migrate-safe)");
    output.log("Preflight-checked: backs up the database first, runs in a maintenance window, and exits cleanly if nothing is pending.");
    if (!confirmed && !(await confirm("Apply all pending migrations to the configured database?"))) { output.log("Cancelled."); return 0; }
    const status = commandStatus(adapter.exec(["php", "artisan", "archive:migrate-safe"]));
    (status === 0 ? output.ok : output.err)(status === 0 ? "Migrations applied." : "Migration failed — application left in maintenance mode. See command output above for rollback steps.");
    return status;
  };
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
    output.titleLine("Backup — pg_dump of the running database");
    const env = readEnv();
    const user = env.POSTGRES_USER || "archive";
    const database = env.POSTGRES_DB || "archive";
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const outFile = join(backupDir, `archive-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
    output.log(`Dumping "${database}" as "${user}" -> ${outFile}`);
    const result = adapter.exec(["pg_dump", "-U", user, database], { service: "postgres", inherit: false });
    if (result.status === 0 && result.stdout) {
      try { writeFileSync(outFile, result.stdout); output.ok(`Backup written: ${outFile}`); return 0; }
      catch (error) { output.err(`Dump ran but could not write file: ${error.message}`); return 1; }
    }
    output.err("Backup failed — start the stack first (the 'postgres' service must be running).");
    return 1;
  };
  const listBackups = () => {
    output.titleLine("Backups");
    const files = listBackupFiles();
    if (!files.length) { output.log("No backups yet."); return 0; }
    files.forEach((file, index) => output.log(`${String(index + 1).padStart(2)}) ${file}`));
    return 0;
  };
  const restoreBackup = async () => {
    output.titleLine("Restore a backup");
    const files = listBackupFiles();
    if (!files.length) { output.warn("No backups to restore."); return 0; }
    files.forEach((file, index) => output.log(`${String(index + 1).padStart(2)}) ${file}`));
    const selected = files[Number(await ask("Restore which backup number")) - 1];
    if (!selected) { output.log("Cancelled."); return 0; }
    output.warn(`This OVERWRITES the current database with ${selected}. This cannot be undone.`);
    if (!(await confirm("Type y to proceed with the destructive restore"))) { output.log("Cancelled."); return 0; }
    const env = readEnv();
    const result = adapter.exec(["psql", "-U", env.POSTGRES_USER || "archive", env.POSTGRES_DB || "archive"], {
      service: "postgres", inherit: false, input: readFileSync(join(backupDir, selected), "utf8"),
    });
    if (result.status === 0) output.ok("Restore complete.");
    else output.err(`Restore failed (exit ${result.status}). ${(result.stderr || "").slice(0, 200)}`);
    return commandStatus(result);
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
  return { serverStatus, serverStart, serverStop, serverRestart, serverLogs, healthCheck, migrateStatus, migrateDeploy, seedDemoData, listBackupFiles, backupNow, listBackups, restoreBackup, runDiagnostics, updateAndRebuild };
}
