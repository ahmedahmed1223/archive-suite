import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: options.inputPath ? readFileSync(options.inputPath, "utf8") : options.input,
    stdio: options.capture || options.outputPath || options.inputPath ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  }
  if (options.outputPath) {
    writeFileSync(options.outputPath, result.stdout);
  }
  return result.stdout?.trim() ?? "";
}

export async function migratePostgres17To18({
  sourceContainer = process.env.ARCHIVE_PG17_CONTAINER ?? "archive-ln-postgres",
  composeFile = "infra/docker-compose.yml",
  environment = process.env,
  runCommand = run,
} = {}) {
  const user = environment.POSTGRES_USER ?? "archive";
  const sourceImage = await runCommand("docker", ["inspect", "--format", "{{.Config.Image}}", sourceContainer], { capture: true });
  if (!/(?:^|[-:])pg17(?:[-:@]|$)|postgres:17/.test(sourceImage)) {
    throw new Error(`Source container ${sourceContainer} is not a PostgreSQL 17 image; refusing migration.`);
  }

  const dumpPath = join(tmpdir(), `archive-postgres17-${Date.now()}.sql`);
  const archivedSource = `${sourceContainer}-pg17-backup-${Date.now()}`;
  let restored = false;

  await runCommand("docker", ["exec", sourceContainer, "pg_dumpall", "-U", user], { outputPath: dumpPath });
  await runCommand("docker", ["stop", sourceContainer]);
  await runCommand("docker", ["rename", sourceContainer, archivedSource]);

  try {
    await runCommand("docker", ["compose", "-f", composeFile, "up", "-d", "postgres"]);
    await runCommand("docker", ["compose", "-f", composeFile, "exec", "-T", "postgres", "pg_isready", "-U", user]);
    await runCommand("docker", ["compose", "-f", composeFile, "exec", "-T", "postgres", "psql", "-U", user, "-d", "postgres"], { inputPath: dumpPath });
    restored = true;
    return { sourceContainer, targetMajor: 18 };
  } finally {
    if (restored && existsSync(dumpPath)) rmSync(dumpPath, { force: true });
  }
}

if (process.argv[1]?.endsWith("migrate-postgres17-to18.mjs")) {
  migratePostgres17To18().then(
    ({ sourceContainer }) => process.stdout.write(`Migrated ${sourceContainer} to PostgreSQL 18; the PostgreSQL 17 container was preserved under a backup name.\n`),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
