import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readWindowsDataPackage } from "./windows-data-package.mjs";
import { stageWindowsDataServices } from "./windows-bundle/stage-data-services.mjs";

function stageFixture(root) {
  const source = join(root, "source");
  const pgvector = join(source, "pgvector");
  const redis = join(source, "redis");
  mkdirSync(pgvector, { recursive: true });
  mkdirSync(redis, { recursive: true });
  const installer = join(source, "postgresql-18.exe");
  writeFileSync(installer, "postgres-installer");
  writeFileSync(join(pgvector, "vector.dll"), "vector-binary");
  writeFileSync(join(pgvector, "vector.control"), "default_version = '0.8.5'\n");
  writeFileSync(join(redis, "redis-server.exe"), "redis-binary");
  const dataServicesPath = join(root, "bundle", "data-services");
  stageWindowsDataServices({ destDir: dataServicesPath, postgresInstaller: installer, pgvectorDirectory: pgvector, redisDirectory: redis });
  return dataServicesPath;
}

test("Windows data package reader returns only verified bundle-relative PostgreSQL, pgvector, and Redis paths", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-windows-package-"));
  try {
    const packageInfo = readWindowsDataPackage({ dataServicesPath: stageFixture(root) });

    assert.match(packageInfo.postgresInstaller, /data-services[\\/]postgresql-installer\.exe$/);
    assert.deepEqual(packageInfo.pgvectorFiles.map((path) => path.split(/[\\/]/).at(-1)), ["vector.control", "vector.dll"]);
    assert.match(packageInfo.redisServer, /data-services[\\/]redis[\\/]redis-server\.exe$/);
    assert.equal(packageInfo.includesPgAdmin, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Windows data package reader rejects a pgvector file modified after staging", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-windows-package-tamper-"));
  try {
    const dataServicesPath = stageFixture(root);
    writeFileSync(join(dataServicesPath, "pgvector", "vector.dll"), "modified");

    assert.throws(() => readWindowsDataPackage({ dataServicesPath }), /checksum/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
