// V1-211B host-effects layer: the REAL Linux commands behind the injected
// seams of createLinuxNativeRuntimeAdapter — systemd units, install-root
// ownership for the non-interactive service user, and logrotate. The runner
// and file writer are injectable so unit tests record commands; defaults use
// spawnSync/fs. Firewall stays optional per the platform contract and is not
// provided here — an operator opts in by injecting applyFirewallRules.
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
// These paths describe the Linux target host, not the machine running this
// tool -- posix join/dirname keep them forward-slashed even when built/tested
// on Windows (plain node:path would emit backslashes there).
import { dirname, join } from "node:path/posix";
import { renderLaravelEnv, renderLinuxCaddyfile, renderPhpFpmConfig } from "./linux-app-config.mjs";
import { LINUX_SERVICES, LINUX_SERVICE_USER, renderSystemdUnit } from "./linux-services.mjs";
import { readLinuxDataPackage } from "./linux-data-package.mjs";
import { ensureServiceUser } from "./linux-bundle/stage-service-user.mjs";

const UNIT_DIR = "/etc/systemd/system";
const LOGROTATE_PATH = "/etc/logrotate.d/archive-suite";

function defaultRun(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function defaultWriteFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function createLinuxHostEffects({ installRoot = LINUX_SERVICE_USER.home, storagePath = join(installRoot, "storage"), services = LINUX_SERVICES, run = defaultRun, writeFile = defaultWriteFile, ensureDirectory = (path) => mkdirSync(path, { recursive: true }), copyFile = (source, destination) => { ensureDirectory(dirname(destination)); copyFileSync(source, destination); }, chmodFile = chmodSync, readDataPackage = readLinuxDataPackage } = {}) {
  const firstFailure = (results) => results.find((result) => (result?.status ?? 1) !== 0) ?? { status: 0 };
  const dataServicesPath = join(installRoot, "data-services");
  const postgresDataPath = join(storagePath, "postgresql");
  const redisDataPath = join(storagePath, "redis");
  const postgresUnitPath = join(UNIT_DIR, "archive-postgres.service");
  const redisUnitPath = join(UNIT_DIR, "archive-redis.service");
  const postgresPasswordPath = join(installRoot, "config", "postgresql-password");
  const databaseBootstrapPath = join(installRoot, "config", "archive-database-bootstrap.sql");
  const redisConfigPath = join(installRoot, "config", "redis.conf");
  let verifiedDataPackage;
  const dataPackage = () => verifiedDataPackage ??= readDataPackage({ dataServicesPath });
  const runtimePostgresRoot = join(installRoot, "runtime", "postgres");
  const runtimePostgresBinary = (name) => join(runtimePostgresRoot, "bin", name);
  const singleLineSecret = (value, label) => {
    if (typeof value !== "string" || !value || /[\r\n]/.test(value)) throw new Error(`Linux managed ${label} must be a non-empty single-line secret.`);
    return value;
  };
  const systemdDataUnit = ({ id, description, type = "simple", execStart, execStop, readWritePaths }) => [
    "[Unit]",
    `Description=${description}`,
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    `Type=${type}`,
    `User=${LINUX_SERVICE_USER.name}`,
    `Group=${LINUX_SERVICE_USER.name}`,
    `ExecStart=${execStart}`,
    `ExecStop=${execStop}`,
    "Restart=on-failure",
    "RestartSec=10",
    "NoNewPrivileges=true",
    "ProtectSystem=strict",
    `ReadWritePaths=${readWritePaths.join(" ")}`,
    "PrivateTmp=true",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n");

  const serviceControl = {
    install(service) {
      writeFile(join(UNIT_DIR, service.unit), renderSystemdUnit(service, { installRoot, storagePath }));
      return firstFailure([run(["systemctl", "daemon-reload"]), run(["systemctl", "enable", service.id])]);
    },
    remove: (id) => firstFailure([
      run(["systemctl", "disable", id]),
      run(["rm", "-f", join(UNIT_DIR, `${id}.service`)]),
      run(["systemctl", "daemon-reload"]),
    ]),
    start: (id) => run(["systemctl", "start", id]),
    stop: (id) => run(["systemctl", "stop", id]),
    restart: (id) => run(["systemctl", "restart", id]),
    query: (id) => run(["systemctl", "status", "--no-pager", id]),
  };

  const applyOwnership = () => firstFailure([...new Set([installRoot, storagePath])].map((path) => run(["chown", "-R", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, path])));

  const applyLogrotate = () => {
    try {
      writeFile(LOGROTATE_PATH, [
        `${join(installRoot, "logs")}/*.log {`,
        "  weekly",
        "  rotate 8",
        "  compress",
        "  missingok",
        "  notifempty",
        `  su ${LINUX_SERVICE_USER.name} ${LINUX_SERVICE_USER.name}`,
        "}",
        "",
      ].join("\n"));
      return { status: 0 };
    } catch { return { status: 1 }; }
  };

  const installPostgres = ({ secrets } = {}) => {
    const ownerPassword = singleLineSecret(secrets?.dbOwnerPassword, "PostgreSQL owner password");
    const payload = dataPackage();
    const user = ensureServiceUser({ run });
    if (!user.ok) return { status: 1, stderr: "The archive service user could not be created." };
    ensureDirectory(postgresDataPath);
    ensureDirectory(join(installRoot, "logs"));
    for (const file of payload.postgresFiles) {
      const relativePath = file.path.replace(/^postgres\//i, "");
      copyFile(file.absolute, join(runtimePostgresRoot, relativePath));
    }
    const initdb = runtimePostgresBinary(payload.initdb.split(/[\\/]/).at(-1));
    const pgCtl = runtimePostgresBinary(payload.pgCtl.split(/[\\/]/).at(-1));
    const psql = runtimePostgresBinary(payload.psql.split(/[\\/]/).at(-1));
    writeFile(postgresPasswordPath, `${ownerPassword}\n`, { mode: 0o600 });
    chmodFile(postgresPasswordPath, 0o600);
    const initialized = existsSync(join(postgresDataPath, "PG_VERSION"))
      ? { status: 0 }
      : run([initdb, "-D", postgresDataPath, "-U", "archive_owner", `--pwfile=${postgresPasswordPath}`, "--auth-host=scram-sha-256"]);
    if ((initialized?.status ?? 1) !== 0) return initialized;
    writeFile(postgresUnitPath, systemdDataUnit({
      id: "archive-postgres",
      description: "Archive Suite bundled PostgreSQL data service",
      type: "forking",
      execStart: `${pgCtl} -D ${postgresDataPath} -l ${join(installRoot, "logs", "postgresql.log")} -o "-p 5432" start`,
      execStop: `${pgCtl} -D ${postgresDataPath} stop -m fast`,
      readWritePaths: [postgresDataPath, join(installRoot, "logs")],
    }));
    const ownership = run(["chown", "-R", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, postgresDataPath]);
    if ((ownership?.status ?? 1) !== 0) return ownership;
    const logsOwnership = run(["chown", "-R", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, join(installRoot, "logs")]);
    if ((logsOwnership?.status ?? 1) !== 0) return logsOwnership;
    return firstFailure([run(["systemctl", "daemon-reload"]), run(["systemctl", "enable", "archive-postgres"]), run(["systemctl", "start", "archive-postgres"]) ]);
  };

  const installPgvector = () => {
    const payload = dataPackage();
    const libDirectory = join(runtimePostgresRoot, "lib");
    const extensionDirectory = join(runtimePostgresRoot, "share", "extension");
    ensureDirectory(libDirectory);
    ensureDirectory(extensionDirectory);
    for (const source of payload.pgvectorFiles) {
      const target = /\.(?:so|so\.[0-9.]+)$/i.test(source) ? join(libDirectory, source.split(/[\\/]/).at(-1)) : join(extensionDirectory, source.split(/[\\/]/).at(-1));
      copyFile(source, target);
    }
    return { status: 0 };
  };

  const createArchiveRoles = ({ secrets } = {}) => {
    const ownerPassword = singleLineSecret(secrets?.dbOwnerPassword, "PostgreSQL owner password");
    const appPassword = singleLineSecret(secrets?.dbAppPassword, "PostgreSQL application password");
    const literal = (value) => `'${value.replaceAll("'", "''")}'`;
    writeFile(databaseBootstrapPath, [
      `ALTER ROLE archive_owner WITH LOGIN SUPERUSER PASSWORD ${literal(ownerPassword)};`,
      "DO $archive$",
      "BEGIN",
      "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'archive_app') THEN",
      `    ALTER ROLE archive_app WITH LOGIN PASSWORD ${literal(appPassword)};`,
      "  ELSE",
      `    CREATE ROLE archive_app LOGIN PASSWORD ${literal(appPassword)};`,
      "  END IF;",
      "END",
      "$archive$;",
      "SELECT 'CREATE DATABASE archive OWNER archive_app' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'archive') \\gexec",
      "\\connect archive",
      "CREATE EXTENSION IF NOT EXISTS vector;",
      "GRANT ALL PRIVILEGES ON DATABASE archive TO archive_app;",
      "GRANT ALL PRIVILEGES ON SCHEMA public TO archive_app;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO archive_app;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO archive_app;",
      "",
    ].join("\n"), { mode: 0o600 });
    chmodFile(databaseBootstrapPath, 0o600);
    return run([runtimePostgresBinary(dataPackage().psql.split(/[\\/]/).at(-1)), "-h", "127.0.0.1", "-p", "5432", "-U", "archive_owner", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", databaseBootstrapPath], { env: { PGPASSWORD: ownerPassword } });
  };

  const installRedisCompatible = ({ secrets } = {}) => {
    const password = singleLineSecret(secrets?.redisPassword, "Redis password");
    const payload = dataPackage();
    const user = ensureServiceUser({ run });
    if (!user.ok) return { status: 1, stderr: "The archive service user could not be created." };
    ensureDirectory(redisDataPath);
    writeFile(redisConfigPath, [
      "bind 127.0.0.1",
      "protected-mode yes",
      "port 6379",
      `requirepass ${password}`,
      `dir \"${redisDataPath.replaceAll('"', '\\\"')}\"`,
      "appendonly yes",
      "",
    ].join("\n"), { mode: 0o600 });
    chmodFile(redisConfigPath, 0o600);
    const ownership = run(["chown", "-R", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, redisDataPath]);
    if ((ownership?.status ?? 1) !== 0) return ownership;
    const configOwnership = run(["chown", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, redisConfigPath]);
    if ((configOwnership?.status ?? 1) !== 0) return configOwnership;
    writeFile(redisUnitPath, systemdDataUnit({
      id: "archive-redis",
      description: "Archive Suite bundled Redis-compatible data service",
      execStart: `${payload.redisServer} ${redisConfigPath}`,
      execStop: "-/bin/kill -TERM $MAINPID",
      readWritePaths: [redisDataPath, join(installRoot, "logs")],
    }));
    return firstFailure([run(["systemctl", "daemon-reload"]), run(["systemctl", "enable", "archive-redis"]), run(["systemctl", "start", "archive-redis"]) ]);
  };

  const writeAppConfig = ({ access, domain, dataPlan, storagePath, appKey, appUrl, dbUsername, dbPassword, redisPassword }) => {
    writeFile(join(installRoot, "config", "Caddyfile"), renderLinuxCaddyfile({ installRoot, access, domain }));
    writeFile(join(installRoot, "config", "php-fpm.conf"), renderPhpFpmConfig({ installRoot }));
    writeFile(join(installRoot, "app", "laravel", ".env"), renderLaravelEnv({ appKey, appUrl, dataPlan, storagePath, dbUsername, dbPassword, redisPassword }));
    return { status: 0 };
  };

  const logs = () => run(["journalctl", "--no-pager", "-n", "200", ...services.flatMap((service) => ["-u", service.id])]);

  const exec = (args) => run([join(installRoot, "runtime", "php", "bin", "php"), join(installRoot, "app", "laravel", "artisan"), ...args]);

  return { serviceControl, applyOwnership, applyLogrotate, writeAppConfig, logs, exec, installPostgres, installPgvector, createArchiveRoles, installRedisCompatible, installPgAdmin: () => ({ status: 0 }) };
}
