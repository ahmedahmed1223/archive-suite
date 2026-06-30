import { describe, expect, it } from "vitest";

import { wrapSqlServerPrismaJsonCompat } from "../prismaJsonCompat.js";

function createDelegate(methods: Record<string, (...args: any[]) => any>) {
  const calls: Record<string, any[]> = {};
  const delegate: Record<string, any> = {};
  for (const [name, impl] of Object.entries(methods)) {
    delegate[name] = async (...args: any[]) => {
      calls[name] = args;
      return impl(...args);
    };
  }
  return { delegate, calls };
}

describe("wrapSqlServerPrismaJsonCompat", () => {
  it("encodes list and JSON fields before writes and decodes returned rows", async () => {
    const apiKey = createDelegate({
      create: ({ data }) => ({ id: "ak_1", ...data }),
    });
    const rightsRecord = createDelegate({
      upsert: ({ create }) => ({ id: "rights_1", ...create }),
    });
    const savedFilter = createDelegate({
      create: ({ data }) => ({ id: "filter_1", ...data }),
    });

    const prisma = wrapSqlServerPrismaJsonCompat({
      apiKey: apiKey.delegate,
      rightsRecord: rightsRecord.delegate,
      savedFilter: savedFilter.delegate,
    }, "sqlserver");

    const key = await prisma.apiKey.create({ data: { scopes: ["read", "write"] } });
    const rights = await prisma.rightsRecord.upsert({
      where: { itemId: "item-1" },
      create: { itemId: "item-1", geoRestrictions: ["SA", "AE"] },
      update: { geoRestrictions: ["SA"] },
    });
    const filter = await prisma.savedFilter.create({
      data: { query: { text: "archive", filters: ["video"] } },
    });

    expect(apiKey.calls.create[0].data.scopes).toBe("[\"read\",\"write\"]");
    expect(key.scopes).toEqual(["read", "write"]);
    expect(rightsRecord.calls.upsert[0].create.geoRestrictions).toBe("[\"SA\",\"AE\"]");
    expect(rightsRecord.calls.upsert[0].update.geoRestrictions).toBe("[\"SA\"]");
    expect(rights.geoRestrictions).toEqual(["SA", "AE"]);
    expect(savedFilter.calls.create[0].data.query).toBe("{\"text\":\"archive\",\"filters\":[\"video\"]}");
    expect(filter.query).toEqual({ text: "archive", filters: ["video"] });
  });

  it("decodes SQL Server string fields from read results", async () => {
    const recordVersion = createDelegate({
      findFirst: () => ({ id: 1n, snapshot: "{\"id\":\"item-1\",\"title\":\"Before\"}" }),
    });
    const webhook = createDelegate({
      findMany: () => [{ id: "wh_1", events: "[\"record.created\"]" }],
    });

    const prisma = wrapSqlServerPrismaJsonCompat({
      recordVersion: recordVersion.delegate,
      webhook: webhook.delegate,
    }, "sqlserver");

    await expect(prisma.recordVersion.findFirst({ where: { id: 1n } })).resolves.toMatchObject({
      snapshot: { id: "item-1", title: "Before" },
    });
    await expect(prisma.webhook.findMany({ where: { ownerId: "u1" } })).resolves.toEqual([
      { id: "wh_1", events: ["record.created"] },
    ]);
  });

  it("translates Prisma list `has` filters into SQL Server text contains filters", async () => {
    const webhook = createDelegate({
      findMany: () => [],
    });

    const prisma = wrapSqlServerPrismaJsonCompat({ webhook: webhook.delegate }, "sqlserver");
    await prisma.webhook.findMany({
      where: { active: true, events: { has: "record.created" } },
    });

    expect(webhook.calls.findMany[0].where).toEqual({
      active: true,
      events: { contains: "\"record.created\"" },
    });
  });

  it("binds non-model client methods to the original Prisma client", () => {
    const brandedClients = new WeakSet();
    const original = {
      apiKey: { findMany: async () => [] },
      $connect() {
        return brandedClients.has(this);
      },
    };
    brandedClients.add(original);

    const prisma = wrapSqlServerPrismaJsonCompat(original, "sqlserver");

    expect(prisma.$connect()).toBe(true);
  });

  it("leaves non-SQL Server Prisma clients untouched", () => {
    const original = { apiKey: { findMany: async () => [] } };
    expect(wrapSqlServerPrismaJsonCompat(original, "postgresql")).toBe(original);
  });
});
