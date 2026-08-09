// V1-210B host-effects layer: the REAL Windows commands behind the injected
// seams of createWindowsNativeRuntimeAdapter. Everything funnels through one
// injectable runner so unit tests record commands instead of touching the
// host; the default runner is spawnSync. Requires a staged install root
// (services\<id>.exe = pinned WinSW copy, per the package manifest).
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { WINDOWS_SERVICES, renderServiceDefinition } from "./windows-services.mjs";
import { renderCaddyfile, renderLaravelEnv } from "./windows-app-config.mjs";
import { readWindowsDataPackage } from "./windows-data-package.mjs";

const HTTP_RULE = "archive-http";

function defaultRun(args, options = {}) {
  const { env, ...spawnOptions } = options;
  const result = spawnSync(args[0], args.slice(1), {
    stdio: "pipe",
    encoding: "utf8",
    ...spawnOptions,
    ...(env ? { env: { ...process.env, ...env } } : {}),
  });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function defaultWriteFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function defaultCopyFile(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function requireSingleLineSecret(value, label) {
  if (typeof value !== "string" || !value || /[\r\n]/.test(value)) throw new Error(`Windows managed ${label} must be a non-empty single-line secret.`);
  return value;
}

function requireOptionValue(value, label) {
  if (typeof value !== "string" || !value || /[\r\n]/.test(value)) throw new Error(`Windows PostgreSQL ${label} is not safe for an installer option file.`);
  return value;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function createWindowsHostEffects({ installRoot, storagePath, services = WINDOWS_SERVICES, run = defaultRun, writeFile = defaultWriteFile, ensureDirectory = (path) => mkdirSync(path, { recursive: true }), copyFile = defaultCopyFile, readDataPackage = readWindowsDataPackage, readLogTail } = {}) {
  if (typeof installRoot !== "string" || !installRoot.trim()) throw new Error("Windows host effects require an install root.");
  const servicesDir = join(installRoot, "services");
  const writablePaths = [...new Set([
    join(installRoot, "storage"),
    join(installRoot, "logs"),
    join(installRoot, "app", "laravel", "storage"),
    join(installRoot, "app", "laravel", "bootstrap", "cache"),
    storagePath || join(installRoot, "storage"),
  ])];
  const exeFor = (id) => join(servicesDir, `${id}.exe`);
  const firstFailure = (results) => results.find((result) => (result?.status ?? 1) !== 0) ?? { status: 0 };
  const postgresRoot = join(installRoot, "runtime", "postgres");
  const postgresDataPath = join(storagePath || join(installRoot, "storage"), "postgresql");
  const dataServicesPath = join(installRoot, "data-services");
  const installerOptionsPath = join(installRoot, "config", "postgresql-installer.options");
  const databaseBootstrapPath = join(installRoot, "config", "archive-database-bootstrap.sql");
  let verifiedDataPackage;
  const dataPackage = () => verifiedDataPackage ??= readDataPackage({ dataServicesPath });

  // The PostgreSQL installer reads its superuser secret from an option file,
  // never from the process command line. This DACL permits only SYSTEM and
  // local administrators to read that short-lived, installation-only file.
  const protectSensitiveFile = (path) => firstFailure([
    run(["icacls", path, "/inheritance:r"]),
    run(["icacls", path, "/grant:r", "*S-1-5-18:(F)"]),
    run(["icacls", path, "/grant:r", "*S-1-5-32-544:(F)"]),
  ]);

  const installPostgres = ({ secrets } = {}) => {
    const ownerPassword = requireSingleLineSecret(secrets?.dbOwnerPassword, "PostgreSQL owner password");
    const payload = dataPackage();
    if (!payload.includesPgAdmin) throw new Error("Windows data package does not include pgAdmin.");
    const options = [
      "mode=unattended",
      "unattendedmodeui=none",
      `prefix=${requireOptionValue(postgresRoot, "prefix")}`,
      `datadir=${requireOptionValue(postgresDataPath, "data directory")}`,
      "enable-components=server,pgAdmin,commandlinetools",
      "disable-components=stackbuilder",
      "serverport=5432",
      "servicename=archive-postgres",
      "superaccount=archive_owner",
      `superpassword=${ownerPassword}`,
      "",
    ].join("\n");
    writeFile(installerOptionsPath, options);
    const protectedFile = protectSensitiveFile(installerOptionsPath);
    if (protectedFile.status !== 0) return protectedFile;
    return run([payload.postgresInstaller, "--optionfile", installerOptionsPath]);
  };

  const installPgvector = () => {
    const payload = dataPackage();
    const libDirectory = join(postgresRoot, "lib");
    const extensionDirectory = join(postgresRoot, "share", "extension");
    ensureDirectory(libDirectory);
    ensureDirectory(extensionDirectory);
    for (const source of payload.pgvectorFiles) {
      const filename = basename(source);
      const destination = join(filename.toLowerCase().endsWith(".dll") ? libDirectory : extensionDirectory, filename);
      copyFile(source, destination);
    }
    return { status: 0 };
  };

  const installPgAdmin = () => {
    if (!dataPackage().includesPgAdmin) throw new Error("Windows data package does not include pgAdmin.");
    return { status: 0 };
  };

  const createArchiveRoles = ({ secrets } = {}) => {
    const ownerPassword = requireSingleLineSecret(secrets?.dbOwnerPassword, "PostgreSQL owner password");
    const appPassword = requireSingleLineSecret(secrets?.dbAppPassword, "PostgreSQL application password");
    // psql is given the owner password through its process environment, while
    // the application password exists only in this ACL-protected script.
    const sql = [
      `ALTER ROLE archive_owner WITH LOGIN SUPERUSER PASSWORD ${sqlLiteral(ownerPassword)};`,
      "DO $archive$",
      "BEGIN",
      "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'archive_app') THEN",
      `    ALTER ROLE archive_app WITH LOGIN PASSWORD ${sqlLiteral(appPassword)};`,
      "  ELSE",
      `    CREATE ROLE archive_app LOGIN PASSWORD ${sqlLiteral(appPassword)};`,
      "  END IF;",
      "END",
      "$archive$;",
      "SELECT 'CREATE DATABASE archive OWNER archive_app'",
      "WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'archive') \\gexec",
      "\\connect archive",
      "CREATE EXTENSION IF NOT EXISTS vector;",
      "GRANT ALL PRIVILEGES ON DATABASE archive TO archive_app;",
      "GRANT ALL PRIVILEGES ON SCHEMA public TO archive_app;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO archive_app;",
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO archive_app;",
      "",
    ].join("\n");
    writeFile(databaseBootstrapPath, sql);
    const protectedFile = protectSensitiveFile(databaseBootstrapPath);
    if (protectedFile.status !== 0) return protectedFile;
    return run([
      join(postgresRoot, "bin", "psql.exe"),
      "-h", "127.0.0.1",
      "-p", "5432",
      "-U", "archive_owner",
      "-d", "postgres",
      "-v", "ON_ERROR_STOP=1",
      "-f", databaseBootstrapPath,
    ], { env: { PGPASSWORD: ownerPassword } });
  };

  const serviceControl = {
    install(service) {
      writeFile(join(servicesDir, `${service.id}.xml`), renderServiceDefinition(service));
      const installed = run([exeFor(service.id), "install"]);
      if (installed.status !== 0) return installed;
      // WinSW's own account validation can't resolve NT SERVICE\<id> before
      // the service exists, so assign the virtual account as a separate step
      // now that the service is registered -- Microsoft's documented
      // two-step pattern (see windows-services.mjs's renderServiceDefinition
      // for the real WinSW error this avoids).
      return run(["sc", "config", service.id, "obj=", `NT SERVICE\\${service.id}`]);
    },
    remove: (id) => run([exeFor(id), "uninstall"]),
    start: (id) => run([exeFor(id), "start"]),
    stop: (id) => run([exeFor(id), "stop"]),
    restart: (id) => run([exeFor(id), "restart"]),
    query: (id) => run([exeFor(id), "status"]),
  };

  // Install-root ACLs for the per-service virtual accounts: read/execute on
  // the tree, modify only on storage and logs.
  const applyAcls = () => {
    writablePaths.forEach((path) => ensureDirectory(path));
    return firstFailure(services.flatMap((service) => [
      run(["icacls", installRoot, "/grant", `NT SERVICE\\${service.id}:(OI)(CI)RX`]),
      ...writablePaths.map((path) => run(["icacls", path, "/grant", `NT SERVICE\\${service.id}:(OI)(CI)M`])),
    ]));
  };

  // Only archive-http accepts inbound traffic; every other service is
  // loopback-only by construction.
  const applyFirewallRules = () => run(["netsh", "advfirewall", "firewall", "add", "rule", `name=${HTTP_RULE}`, "dir=in", "action=allow", "protocol=TCP", "localport=443"]);
  const removeFirewallRules = () => run(["netsh", "advfirewall", "firewall", "delete", "rule", `name=${HTTP_RULE}`]);

  const logs = () => {
    try {
      const read = readLogTail || (() => readdirSync(servicesDir)
        .filter((name) => name.endsWith(".out.log"))
        .map((name) => `── ${name} ──\n${readFileSync(join(servicesDir, name), "utf8").split("\n").slice(-50).join("\n")}`)
        .join("\n"));
      return { status: 0, stdout: read() };
    } catch { return { status: 1 }; }
  };

  const exec = (args) => run([join(installRoot, "runtime", "php", "php.exe"), join(installRoot, "app", "laravel", "artisan"), ...args]);

  // assemble.mjs stages an empty config/ directory; the actual Caddyfile and
  // Laravel .env can only be rendered here, at install time, once the
  // resolved data plan and access mode are known.
  const writeAppConfig = ({ access, domain, dataPlan, storagePath, appKey, appUrl, dbUsername, dbPassword }) => {
    writeFile(join(installRoot, "config", "Caddyfile"), renderCaddyfile({ installRoot, access, domain }));
    writeFile(join(installRoot, "app", "laravel", ".env"), renderLaravelEnv({ appKey, appUrl, dataPlan, storagePath, dbUsername, dbPassword }));
    return { status: 0 };
  };

  return { serviceControl, applyAcls, applyFirewallRules, removeFirewallRules, writeAppConfig, logs, exec, installPostgres, installPgvector, createArchiveRoles, installPgAdmin };
}
