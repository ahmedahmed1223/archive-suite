import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageLinuxDataServices } from "./stage-data-services.mjs";

test("stages verified Linux data-service directories and writes a manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-linux-data-"));
  try {
    for (const name of ["postgres", "pgvector", "redis"]) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, `${name}.bin`), name);
    }
    const outDir = join(root, "out");
    const result = stageLinuxDataServices({
      destDir: outDir,
      postgresDirectory: join(root, "postgres"),
      pgvectorDirectory: join(root, "pgvector"),
      redisDirectory: join(root, "redis"),
    });
    assert.equal(result.ok, true);
    assert.ok(existsSync(join(outDir, "postgres", "postgres.bin")));
    assert.ok(existsSync(join(outDir, "pgvector", "pgvector.bin")));
    assert.ok(existsSync(join(outDir, "redis", "redis.bin")));
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
    assert.deepEqual(Object.keys(manifest.components), ["postgres", "pgvector", "redis"]);
    assert.match(manifest.components.postgres.files[0].sha256, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects incomplete Linux data-service inputs and symlinks", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-linux-data-invalid-"));
  try {
    const postgres = join(root, "postgres");
    const pgvector = join(root, "pgvector");
    mkdirSync(postgres, { recursive: true });
    mkdirSync(pgvector, { recursive: true });
    writeFileSync(join(postgres, "postgres.bin"), "postgres");
    writeFileSync(join(pgvector, "pgvector.so"), "vector");
    assert.throws(() => stageLinuxDataServices({ destDir: join(root, "out"), postgresDirectory: postgres, pgvectorDirectory: pgvector }), /redisDirectory/);
    const redis = join(root, "redis");
    mkdirSync(redis, { recursive: true });
    symlinkSync(join(root, "outside"), join(redis, "escape"), process.platform === "win32" ? "junction" : "file");
    assert.throws(() => stageLinuxDataServices({ destDir: join(root, "out"), postgresDirectory: postgres, pgvectorDirectory: pgvector, redisDirectory: redis }), /symbolic links/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
