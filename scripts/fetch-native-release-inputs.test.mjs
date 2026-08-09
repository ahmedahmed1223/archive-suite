import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchWindowsReleaseInputs, validateWindowsReleaseInputEnvironment } from "./fetch-native-release-inputs.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("requires HTTPS sources and exact SHA-256 values for Windows release inputs", () => {
  assert.throws(
    () => validateWindowsReleaseInputEnvironment({
      POSTGRES_URL: "http://example.test/postgres.exe",
      POSTGRES_SHA256: "bad",
      PGVECTOR_URL: "https://example.test/pgvector.zip",
      PGVECTOR_SHA256: "0".repeat(64),
    }),
    /HTTPS.*SHA-256/i,
  );
});

test("downloads verified inputs and extracts pgvector into bounded paths", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "native-inputs-"));
  const postgres = Buffer.from("postgres-installer");
  const pgvector = Buffer.from("pgvector-archive");
  const env = {
    POSTGRES_URL: "https://example.test/postgres.exe",
    POSTGRES_SHA256: digest(postgres),
    PGVECTOR_URL: "https://example.test/pgvector.zip",
    PGVECTOR_SHA256: digest(pgvector),
  };
  try {
    const result = await fetchWindowsReleaseInputs({
      outDir,
      env,
      fetchBytes: async (url) => url.includes("postgres") ? postgres : pgvector,
      extractPgvector: ({ destination }) => {
        mkdirSync(destination, { recursive: true });
        writeFileSync(join(destination, "vector.dll"), "verified");
      },
    });
    assert.equal(readFileSync(result.postgresInstaller, "utf8"), "postgres-installer");
    assert.equal(readFileSync(join(result.pgvectorDirectory, "vector.dll"), "utf8"), "verified");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("rejects a downloaded input whose digest differs", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "native-inputs-bad-"));
  try {
    await assert.rejects(
      fetchWindowsReleaseInputs({
        outDir,
        env: {
          POSTGRES_URL: "https://example.test/postgres.exe",
          POSTGRES_SHA256: "0".repeat(64),
          PGVECTOR_URL: "https://example.test/pgvector.zip",
          PGVECTOR_SHA256: "1".repeat(64),
        },
        fetchBytes: async () => Buffer.from("modified"),
      }),
      /checksum mismatch/i,
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
