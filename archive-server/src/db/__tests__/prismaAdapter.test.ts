import { describe, expect, it } from "vitest";

import { createPrismaDriverAdapter } from "../prismaAdapter.js";

describe("createPrismaDriverAdapter", () => {
  it("creates a SQL Server Prisma adapter without requiring a connection", async () => {
    const adapter = await createPrismaDriverAdapter({
      databaseEngine: "sqlserver",
      databaseUrl: "sqlserver://sqlserver:1433;database=archive;user=sa;password=Password-123;encrypt=true;trustServerCertificate=true"
    });

    expect(adapter).toMatchObject({
      provider: "sqlserver"
    });
    expect((adapter as any).connect).toBeTypeOf("function");
  });
});
