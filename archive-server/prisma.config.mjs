// Prisma 7 config — replaces the datasource `url` that used to live in
// schema.prisma. The CLI (generate / migrate deploy) reads the connection
// from here; the runtime client connects via the @prisma/adapter-pg driver
// adapter in src/index.js (Prisma 7 wires migrations for driver adapters
// automatically, so no adapter field is needed here).
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url: process.env.DATABASE_URL || ""
  }
});
