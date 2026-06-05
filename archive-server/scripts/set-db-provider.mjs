// Deploy-time Prisma datasource provider selector.
//
// Prisma 7 does NOT allow env() in `datasource.provider`, so the engine is
// fixed in schema.prisma at generate time. This script rewrites the
// datasource provider from DATABASE_PROVIDER before `prisma generate` /
// `prisma migrate`, so one codebase can target Postgres / MySQL / SQLite /
// SQL Server by setting an env var in the deployment image. (The admin config +
// SPA already capture the engine + build connection URLs.)
//
// Pure core (applyDbProvider / normalizeDbProvider) is unit-tested in
// scripts/verify-db-provider.mjs — no filesystem needed there.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DB_PROVIDERS = Object.freeze(["postgresql", "mysql", "sqlite", "sqlserver"]);
export const DEFAULT_DB_PROVIDER = "postgresql";

/** Strict normalizer with common aliases; unknown -> default (postgresql). */
export function normalizeDbProvider(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "mssql") return "sqlserver";
  if (v === "postgres" || v === "pg") return "postgresql";
  return DB_PROVIDERS.includes(v) ? v : DEFAULT_DB_PROVIDER;
}

/**
 * Rewrite ONLY the `provider = "..."` inside the `datasource db { ... }` block
 * (the generator block's provider is left untouched). Idempotent.
 */
export function applyDbProvider(schemaText, provider) {
  const next = normalizeDbProvider(provider);
  return String(schemaText).replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")[^"]*(")/m,
    `$1${next}$2`
  );
}

// Run as a script: rewrite prisma/schema.prisma from DATABASE_PROVIDER.
if (process.argv[1] && process.argv[1].endsWith("set-db-provider.mjs")) {
  const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
  const provider = normalizeDbProvider(process.env.DATABASE_PROVIDER);
  const before = readFileSync(schemaPath, "utf8");
  const after = applyDbProvider(before, provider);
  if (after !== before) writeFileSync(schemaPath, after);
  console.log(`[set-db-provider] datasource provider = ${provider}${after !== before ? " (updated)" : ""}`);
}
