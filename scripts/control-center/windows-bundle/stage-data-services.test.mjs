import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stageWindowsDataServices } from "./stage-data-services.mjs";

test("Windows data staging bundles PostgreSQL, pgvector, and the pgAdmin component manifest without build paths", () => {
  const root = mkdtempSync(join(tmpdir(), "archive-windows-data-stage-"));
  try {
    const source = join(root, "source");
    const out = join(root, "bundle", "data-services");
    const pgvector = join(source, "pgvector");
    mkdirSync(pgvector, { recursive: true });
    const installer = join(source, "postgresql-18.exe");
    writeFileSync(installer, "postgres-installer");
    writeFileSync(join(pgvector, "vector.dll"), "vector-binary");
    writeFileSync(join(pgvector, "vector.control"), "default_version = '0.8.5'\n");

    const result = stageWindowsDataServices({ destDir: out, postgresInstaller: installer, pgvectorDirectory: pgvector });

    assert.equal(result.ok, true);
    assert.equal(existsSync(join(out, "postgresql-installer.exe")), true);
    assert.equal(existsSync(join(out, "pgvector", "vector.dll")), true);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    assert.deepEqual(manifest.components.pgAdmin, { bundledWith: "postgres" });
    assert.equal(manifest.components.postgres.installer, "postgresql-installer.exe");
    assert.match(manifest.components.postgres.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(manifest.components.pgvector.files.map((file) => file.path), ["pgvector/vector.control", "pgvector/vector.dll"]);
    assert.doesNotMatch(JSON.stringify(manifest), new RegExp(root.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
