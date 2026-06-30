import { describe, it, expect, vi } from "vitest";
import { buildExtraHealth } from "../index.js";

// Minimal stubs — no real DB, no real Redis.
// We only care about whether $queryRawUnsafe is called and what pgvector shape comes back.

function makeStubPrisma() {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ extversion: "0.8.0" }]),
  };
}

describe("buildExtraHealth", () => {
  it("postgres: calls $queryRawUnsafe and returns pgvector version", async () => {
    const prisma = makeStubPrisma();
    const result = await buildExtraHealth({
      prisma,
      mediaJobStore: null,
      databaseEngine: "postgres",
    });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
    expect(result.pgvector).toMatchObject({ ok: true, version: "0.8.0" });
    expect(result.pgvector?.skipped).toBeUndefined();
  });

  it("sqlserver: does NOT call $queryRawUnsafe, returns skipped shape with no error", async () => {
    const prisma = makeStubPrisma();
    const result = await buildExtraHealth({
      prisma,
      mediaJobStore: null,
      databaseEngine: "sqlserver",
    });
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(result.pgvector).toMatchObject({ ok: false, skipped: true, reason: "not-postgres" });
    expect(result.pgvector?.error).toBeUndefined();
  });

  it("no prisma: pgvector field absent", async () => {
    const result = await buildExtraHealth({
      prisma: null,
      mediaJobStore: null,
      databaseEngine: null,
    });
    expect(result.pgvector).toBeUndefined();
  });
});
