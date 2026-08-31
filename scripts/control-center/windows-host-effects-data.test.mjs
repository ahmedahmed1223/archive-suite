import assert from "node:assert/strict";
import test from "node:test";

import { createWindowsHostEffects } from "./windows-host-effects.mjs";

function recorder() {
  const commands = [];
  const files = [];
  const copies = [];
  return {
    commands,
    files,
    copies,
    run: (args, options) => { commands.push({ args, options }); return { status: 0 }; },
    writeFile: (path, content) => files.push({ path, content }),
    copyFile: (source, destination) => copies.push({ source, destination }),
  };
}

test("managed PostgreSQL setup passes the generated secret only through a protected EDB option file", () => {
  const rec = recorder();
  const effects = createWindowsHostEffects({
    installRoot: "C:\\Archive Suite",
    storagePath: "D:\\ArchiveData",
    run: rec.run,
    writeFile: rec.writeFile,
    ensureDirectory: () => {},
    readDataPackage: () => ({
      postgresInstaller: "C:\\Archive Suite\\data-services\\postgresql-installer.exe",
      pgvectorFiles: ["C:\\Archive Suite\\data-services\\pgvector\\vector.dll", "C:\\Archive Suite\\data-services\\pgvector\\vector.control"],
      includesPgAdmin: true,
    }),
  });

  const result = effects.installPostgres({ secrets: { dbOwnerPassword: "owner-secret" } });

  assert.equal(result.status, 0);
  const installer = rec.commands.find(({ args }) => args[0].endsWith("postgresql-installer.exe"));
  assert.deepEqual(installer.args, [
    "C:\\Archive Suite\\data-services\\postgresql-installer.exe",
    "--optionfile",
    "C:\\Archive Suite\\config\\postgresql-installer.options",
  ]);
  assert.doesNotMatch(JSON.stringify(installer.args), /owner-secret/);
  const optionFile = rec.files.find(({ path }) => path.endsWith("postgresql-installer.options"));
  assert.match(optionFile.content, /^mode=unattended$/m);
  assert.match(optionFile.content, /^enable-components=server,pgAdmin,commandlinetools$/m);
  assert.match(optionFile.content, /^disable-components=stackbuilder$/m);
  assert.match(optionFile.content, /^superpassword=owner-secret$/m);
  assert.ok(rec.commands.some(({ args }) => args[0] === "icacls" && args[1].endsWith("postgresql-installer.options")));
});

test("managed pgvector setup copies verified extension artifacts to the PostgreSQL library layout", () => {
  const rec = recorder();
  const effects = createWindowsHostEffects({
    installRoot: "C:\\Archive Suite",
    run: rec.run,
    writeFile: rec.writeFile,
    ensureDirectory: () => {},
    copyFile: rec.copyFile,
    readDataPackage: () => ({
      postgresInstaller: "C:\\Archive Suite\\data-services\\postgresql-installer.exe",
      pgvectorFiles: ["C:\\Archive Suite\\data-services\\pgvector\\vector.dll", "C:\\Archive Suite\\data-services\\pgvector\\vector.control", "C:\\Archive Suite\\data-services\\pgvector\\vector--0.8.0.sql"],
      includesPgAdmin: true,
    }),
  });

  const result = effects.installPgvector();

  assert.equal(result.status, 0);
  assert.deepEqual(rec.copies, [
    { source: "C:\\Archive Suite\\data-services\\pgvector\\vector.dll", destination: "C:\\Archive Suite\\runtime\\postgres\\lib\\vector.dll" },
    { source: "C:\\Archive Suite\\data-services\\pgvector\\vector.control", destination: "C:\\Archive Suite\\runtime\\postgres\\share\\extension\\vector.control" },
    { source: "C:\\Archive Suite\\data-services\\pgvector\\vector--0.8.0.sql", destination: "C:\\Archive Suite\\runtime\\postgres\\share\\extension\\vector--0.8.0.sql" },
  ]);
});

test("managed Redis grants its service account storage access and starts before the readiness probe", () => {
  const rec = recorder();
  const effects = createWindowsHostEffects({
    installRoot: "C:\\Archive Suite",
    storagePath: "D:\\ArchiveData",
    run: rec.run,
    writeFile: rec.writeFile,
    ensureDirectory: () => {},
    copyFile: rec.copyFile,
    pathExists: () => true,
    readDataPackage: () => ({ redisServer: "C:\\Archive Suite\\data-services\\redis\\Redis-8.10.1\\redis-server.exe" }),
  });

  assert.equal(effects.installRedisCompatible({ secrets: { redisPassword: "cache-secret" } }).status, 0);
  assert.match(rec.files.find(({ path }) => path.endsWith("archive-redis.xml")).content, /Redis-8\.10\.1\\redis-server\.exe/);
  assert.ok(rec.commands.some(({ args }) => args.join(" ") === "icacls C:\\Archive Suite /grant NT SERVICE\\archive-redis:(OI)(CI)RX"));
  assert.ok(rec.commands.some(({ args }) => args.join(" ") === "icacls D:\\ArchiveData\\redis /grant NT SERVICE\\archive-redis:(OI)(CI)M"));
  assert.ok(rec.commands.some(({ args }) => args.join(" ") === "C:\\Archive Suite\\services\\archive-redis.exe start"));
});

test("managed Redis returns its protected service log when startup fails", () => {
  const rec = recorder();
  rec.run = (args, options) => {
    rec.commands.push({ args, options });
    return args.at(-1) === "start" ? { status: 1, stderr: "WinSW start failed" } : { status: 0 };
  };
  const effects = createWindowsHostEffects({
    installRoot: "C:\\Archive Suite", storagePath: "D:\\ArchiveData", run: rec.run,
    writeFile: rec.writeFile, ensureDirectory: () => {}, copyFile: rec.copyFile, pathExists: () => true,
    readLogTail: () => "redis wrapper startup detail",
    readDataPackage: () => ({ redisServer: "C:\\Archive Suite\\data-services\\redis\\redis-server.exe" }),
  });

  const result = effects.installRedisCompatible({ secrets: { redisPassword: "cache-secret" } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /WinSW start failed/);
  assert.match(result.stderr, /redis wrapper startup detail/);
});

test("managed database bootstrap keeps both account passwords out of psql arguments and grants the application account ownership", () => {
  const rec = recorder();
  const effects = createWindowsHostEffects({
    installRoot: "C:\\Archive Suite",
    run: rec.run,
    writeFile: rec.writeFile,
    ensureDirectory: () => {},
  });

  const result = effects.createArchiveRoles({
    secrets: { dbOwnerPassword: "owner-secret", dbAppPassword: "app-secret" },
  });

  assert.equal(result.status, 0);
  const psql = rec.commands.find(({ args }) => args[0].endsWith("postgres\\bin\\psql.exe"));
  assert.deepEqual(psql.args, [
    "C:\\Archive Suite\\runtime\\postgres\\bin\\psql.exe",
    "-h", "127.0.0.1",
    "-p", "5432",
    "-U", "archive_owner",
    "-d", "postgres",
    "-v", "ON_ERROR_STOP=1",
    "-f", "C:\\Archive Suite\\config\\archive-database-bootstrap.sql",
  ]);
  assert.equal(psql.options.env.PGPASSWORD, "owner-secret");
  assert.doesNotMatch(JSON.stringify(psql.args), /owner-secret|app-secret/);
  const bootstrapFile = rec.files.find(({ path }) => path.endsWith("archive-database-bootstrap.sql"));
  assert.match(bootstrapFile.content, /CREATE ROLE archive_app LOGIN PASSWORD 'app-secret'/);
  assert.match(bootstrapFile.content, /CREATE DATABASE archive OWNER archive_app/);
  assert.match(bootstrapFile.content, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.ok(rec.commands.some(({ args }) => args[0] === "icacls" && args[1].endsWith("archive-database-bootstrap.sql")));
});
