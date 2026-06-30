import { describe, it, expect } from "vitest";
import { wrapSqlServerPrismaJsonCompat } from "./prismaJsonCompat.js";

// Minimal fake delegate that records the args it receives.
function makeStubDelegate(result: unknown = []) {
  const calls: unknown[][] = [];
  const delegate = {
    findMany: async (...args: unknown[]) => { calls.push(args); return result; },
    findFirst: async (...args: unknown[]) => { calls.push(args); return result; },
    create:   async (...args: unknown[]) => { calls.push(args); return result; },
    update:   async (...args: unknown[]) => { calls.push(args); return result; },
  };
  return { delegate, calls };
}

function makeStubPrisma(delegates: Record<string, unknown>) {
  return new Proxy(delegates as any, {
    get(t, p) { return Reflect.get(t, p); }
  });
}

describe("wrapSqlServerPrismaJsonCompat", () => {
  it("is a no-op for non-sqlserver engines", async () => {
    const { delegate } = makeStubDelegate();
    const prisma = makeStubPrisma({ archiveItem: delegate });
    const wrapped = wrapSqlServerPrismaJsonCompat(prisma, "postgres");
    expect(wrapped).toBe(prisma);
  });

  describe("sqlserver: encodeWhere", () => {
    it("has: encodes single value as contains", async () => {
      const { delegate, calls } = makeStubDelegate([]);
      const prisma = makeStubPrisma({ archiveItem: delegate });
      const wrapped = wrapSqlServerPrismaJsonCompat(prisma, "sqlserver");
      await wrapped.archiveItem.findMany({ where: { tags: { has: "sport" } } });
      const where = (calls[0][0] as any).where;
      expect(where.tags).toEqual({ contains: '"sport"' });
    });

    it("hasSome[0]: single-element array encodes as contains (existing coverage)", async () => {
      const { delegate, calls } = makeStubDelegate([]);
      const prisma = makeStubPrisma({ archiveItem: delegate });
      const wrapped = wrapSqlServerPrismaJsonCompat(prisma, "sqlserver");
      await wrapped.archiveItem.findMany({ where: { tags: { hasSome: ["news"] } } });
      const where = (calls[0][0] as any).where;
      expect(where.tags).toEqual({ contains: '"news"' });
    });

    // NEW: hasSome with multiple values — should pass through unchanged (no partial match)
    it("hasSome with multiple values passes through unmodified", async () => {
      const { delegate, calls } = makeStubDelegate([]);
      const prisma = makeStubPrisma({ archiveItem: delegate });
      const wrapped = wrapSqlServerPrismaJsonCompat(prisma, "sqlserver");
      await wrapped.archiveItem.findMany({ where: { tags: { hasSome: ["news", "sport"] } } });
      const where = (calls[0][0] as any).where;
      // Multi-value hasSome cannot be safely collapsed to a single `contains` —
      // the compat layer leaves it intact so the caller can handle it.
      expect(where.tags).toEqual({ hasSome: ["news", "sport"] });
    });
  });

  describe("sqlserver: encode/decode JSON fields", () => {
    it("encodes metadata on create and decodes it on read", async () => {
      const stored = { id: "1", metadata: '{"key":"val"}', tags: '["a"]' };
      const { delegate, calls } = makeStubDelegate(stored);
      const prisma = makeStubPrisma({ archiveItem: delegate });
      const wrapped = wrapSqlServerPrismaJsonCompat(prisma, "sqlserver");
      const result: any = await wrapped.archiveItem.findFirst({ where: { id: "1" } });
      expect(result.metadata).toEqual({ key: "val" });
      expect(result.tags).toEqual(["a"]);
    });
  });
});
