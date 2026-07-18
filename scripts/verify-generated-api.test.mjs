import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateApiTypes, verifyGeneratedApiTypes } from "./generate-api-types.mjs";

test("generates deterministic OpenAPI paths and components", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "archive-api-types-test-"));
  const outputPath = path.join(directory, "archive-api.ts");
  try {
    await generateApiTypes({ outputPath });
    const generated = await readFile(outputPath, "utf8");
    assert.match(generated, /export interface paths/);
    assert.match(generated, /export interface components/);
    assert.doesNotMatch(generated, /Generated at|[A-Z]:\\/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports drift without mutating the compared output", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "archive-api-drift-test-"));
  const outputPath = path.join(directory, "archive-api.ts");
  try {
    await writeFile(outputPath, "// stale\n", "utf8");
    const result = await verifyGeneratedApiTypes({ outputPath });
    assert.equal(result.ok, false);
    assert.equal(await readFile(outputPath, "utf8"), "// stale\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
