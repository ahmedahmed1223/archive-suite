import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchLinuxReleaseInputs, fetchWindowsReleaseInputs, validateLinuxReleaseInputEnvironment, validateWindowsReleaseInputEnvironment } from "./fetch-native-release-inputs.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("requires HTTPS sources and exact SHA-256 values for Windows release inputs", () => {
  assert.throws(
    () => validateWindowsReleaseInputEnvironment({
      POSTGRES_URL: "http://example.test/postgres.exe",
      POSTGRES_SHA256: "bad",
      PGVECTOR_URL: "https://example.test/pgvector.zip",
      PGVECTOR_SHA256: "0".repeat(64),
      REDIS_URL: "https://example.test/redis.zip",
      REDIS_SHA256: "0".repeat(64),
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
    REDIS_URL: "https://example.test/redis.zip",
    REDIS_SHA256: digest(Buffer.from("redis-archive")),
  };
  try {
    const result = await fetchWindowsReleaseInputs({
      outDir,
      env,
      fetchBytes: async (url) => url.includes("postgres") ? postgres : url.includes("pgvector") ? pgvector : Buffer.from("redis-archive"),
      extractPgvector: ({ destination }) => {
        mkdirSync(destination, { recursive: true });
        writeFileSync(join(destination, "vector.dll"), "verified");
      },
      extractArchive: ({ destination }) => {
        mkdirSync(destination, { recursive: true });
        writeFileSync(join(destination, "redis-server.exe"), "verified");
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
          REDIS_URL: "https://example.test/redis.zip",
          REDIS_SHA256: "2".repeat(64),
        },
        fetchBytes: async () => Buffer.from("modified"),
      }),
      /checksum mismatch/i,
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("requires all three immutable Linux Native archives", () => {
  assert.throws(
    () => validateLinuxReleaseInputEnvironment({
      POSTGRES_URL: "https://example.test/postgres.tar.gz",
      POSTGRES_SHA256: "0".repeat(64),
      PGVECTOR_URL: "https://example.test/pgvector.tar.gz",
      PGVECTOR_SHA256: "0".repeat(64),
      REDIS_URL: "http://example.test/redis.tar.gz",
      REDIS_SHA256: "0".repeat(64),
    }),
    /three HTTPS sources.*SHA-256/i,
  );
});

test("downloads and extracts verified Linux Native data-service archives", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "native-linux-inputs-"));
  const archives = {
    postgres: Buffer.from("postgres-linux"),
    pgvector: Buffer.from("pgvector-linux"),
    redis: Buffer.from("redis-linux"),
  };
  const env = Object.fromEntries(Object.entries(archives).flatMap(([name, bytes]) => [
    [`${name.toUpperCase()}_URL`, `https://example.test/${name}.tar.gz`],
    [`${name.toUpperCase()}_SHA256`, digest(bytes)],
  ]));
  try {
    const result = await fetchLinuxReleaseInputs({
      outDir,
      env,
      fetchBytes: async (url) => archives[Object.keys(archives).find((name) => url.includes(name))],
      extractArchive: async ({ destination, label }) => {
        mkdirSync(destination, { recursive: true });
        writeFileSync(join(destination, `${label}.bin`), "verified");
      },
    });
    assert.equal(readFileSync(join(result.postgres, "postgres.bin"), "utf8"), "verified");
    assert.equal(readFileSync(join(result.pgvector, "pgvector.bin"), "utf8"), "verified");
    assert.equal(readFileSync(join(result.redis, "redis.bin"), "utf8"), "verified");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
