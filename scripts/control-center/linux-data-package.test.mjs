import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readLinuxDataPackage } from "./linux-data-package.mjs";

function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

test("Linux data package reader verifies the manifest and exposes managed-service binaries", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-linux-package-"));
  try {
    for (const name of ["postgres/bin", "pgvector", "redis/bin"]) mkdirSync(join(root, name), { recursive: true });
    for (const [path, value] of [
      ["postgres/bin/initdb", "initdb"], ["postgres/bin/pg_ctl", "pg_ctl"], ["postgres/bin/psql", "psql"],
      ["pgvector/vector.so", "vector"], ["redis/bin/redis-server", "redis"],
    ]) writeFileSync(join(root, path), value);
    const files = (directory) => {
      const names = directory === "postgres" ? ["postgres/bin/initdb", "postgres/bin/pg_ctl", "postgres/bin/psql"]
        : directory === "pgvector" ? ["pgvector/vector.so"] : ["redis/bin/redis-server"];
      return names.map((path) => ({ path, sha256: sha256(join(root, path)) }));
    };
    writeFileSync(join(root, "manifest.json"), JSON.stringify({
      schemaVersion: "1.0", platform: "linux-native",
      components: { postgres: { files: files("postgres") }, pgvector: { files: files("pgvector") }, redis: { files: files("redis") } },
    }));

    const packageInfo = readLinuxDataPackage({ dataServicesPath: root });
    assert.match(packageInfo.initdb, /postgres[\\/]bin[\\/]initdb$/);
    assert.match(packageInfo.pgCtl, /postgres[\\/]bin[\\/]pg_ctl$/);
    assert.match(packageInfo.psql, /postgres[\\/]bin[\\/]psql$/);
    assert.match(packageInfo.redisServer, /redis[\\/]bin[\\/]redis-server$/);
    assert.equal(packageInfo.pgvectorFiles.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Linux data package reader rejects a modified payload", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-linux-package-tamper-"));
  try {
    for (const name of ["postgres/bin", "pgvector", "redis/bin"]) mkdirSync(join(root, name), { recursive: true });
    for (const path of ["postgres/bin/initdb", "postgres/bin/pg_ctl", "postgres/bin/psql", "pgvector/vector.so", "redis/bin/redis-server"]) writeFileSync(join(root, path), path);
    const digest = (path) => sha256(join(root, path));
    const manifest = { schemaVersion: "1.0", platform: "linux-native", components: {
      postgres: { files: ["postgres/bin/initdb", "postgres/bin/pg_ctl", "postgres/bin/psql"].map((path) => ({ path, sha256: digest(path) })) },
      pgvector: { files: [{ path: "pgvector/vector.so", sha256: digest("pgvector/vector.so") }] },
      redis: { files: [{ path: "redis/bin/redis-server", sha256: digest("redis/bin/redis-server") }] },
    } };
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest));
    writeFileSync(join(root, "pgvector/vector.so"), "tampered");
    assert.throws(() => readLinuxDataPackage({ dataServicesPath: root }), /checksum/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Linux data package reader accepts PostgreSQL timezone names containing plus", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-linux-package-timezone-"));
  try {
    for (const name of ["postgres/bin", "postgres/share/timezone/Etc", "pgvector", "redis/bin"]) mkdirSync(join(root, name), { recursive: true });
    for (const [path, value] of [
      ["postgres/bin/initdb", "initdb"], ["postgres/bin/pg_ctl", "pg_ctl"], ["postgres/bin/psql", "psql"],
      ["postgres/share/timezone/Etc/GMT+1", "timezone"], ["pgvector/vector.so", "vector"], ["redis/bin/redis-server", "redis"],
    ]) writeFileSync(join(root, path), value);
    const files = ["postgres/bin/initdb", "postgres/bin/pg_ctl", "postgres/bin/psql", "postgres/share/timezone/Etc/GMT+1"]
      .map((path) => ({ path, sha256: sha256(join(root, path)) }));
    writeFileSync(join(root, "manifest.json"), JSON.stringify({
      schemaVersion: "1.0", platform: "linux-native",
      components: {
        postgres: { files },
        pgvector: { files: [{ path: "pgvector/vector.so", sha256: sha256(join(root, "pgvector/vector.so")) }] },
        redis: { files: [{ path: "redis/bin/redis-server", sha256: sha256(join(root, "redis/bin/redis-server")) }] },
      },
    }));
    assert.doesNotThrow(() => readLinuxDataPackage({ dataServicesPath: root }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
