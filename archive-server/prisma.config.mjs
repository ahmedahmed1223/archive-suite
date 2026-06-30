// Prisma 7 config — replaces the datasource `url` that used to live in
// schema.prisma. The CLI (generate / migrate deploy) reads the connection
// from here; the runtime client connects via a provider-specific Prisma driver
// adapter in src/index.js (Prisma 7 wires migrations for driver adapters
// automatically, so no adapter field is needed here).
import { defineConfig } from "prisma/config";

export function resolvePrismaMigrationsPath(provider = process.env.DATABASE_PROVIDER) {
  const normalized = String(provider || "postgresql").trim().toLowerCase();
  return normalized === "sqlserver" || normalized === "mssql"
    ? "prisma/migrations-sqlserver"
    : "prisma/migrations";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: resolvePrismaMigrationsPath()
  },
  datasource: {
    url: process.env.DATABASE_URL || ""
  }
});
