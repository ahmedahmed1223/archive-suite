// Deploy-time Prisma datasource provider selector.
//
// Prisma 7 does NOT allow env() in `datasource.provider`, so the engine is
// fixed in the schema passed to generate/migrate. This script writes a
// provider-specific prisma/schema.active.prisma from the canonical
// prisma/schema.prisma before `prisma generate` / `prisma migrate`, so one
// codebase can target Postgres / MySQL / SQLite / SQL Server by setting an env
// var in the deployment image. (The admin config + SPA already capture the
// engine + build connection URLs.)
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

function sqlServerFieldLine(line) {
  const appendNVarCharMax = (rest) => {
    const commentAt = rest.indexOf("//");
    if (commentAt === -1) return `${rest} @db.NVarChar(Max)`;
    const attrs = rest.slice(0, commentAt).trimEnd();
    const comment = rest.slice(commentAt).trimStart();
    return `${attrs} @db.NVarChar(Max) ${comment}`;
  };
  if (/\bUnsupported\("vector\(1536\)"\)\?/.test(line)) {
    return line.replace(/Unsupported\("vector\(1536\)"\)\?/, "String? @db.NVarChar(Max)");
  }
  if (/\bLicenseType\b/.test(line) && !/^\s*enum\s+LicenseType\b/.test(line)) {
    return line.replace(/\bLicenseType\b/, "String");
  }
  if (/\bString\[\]/.test(line)) {
    return line.replace(/\bString\[\]/, 'String @default("[]") @db.NVarChar(Max)');
  }
  const jsonMatch = line.match(/^(\s*\w+\s+)Json(\??)(.*)$/);
  if (jsonMatch) {
    const [, prefix, optional, rest] = jsonMatch;
    return `${prefix}String${optional}${appendNVarCharMax(rest)}`;
  }
  return line;
}

export function applySqlServerCompatibility(schemaText) {
  return String(schemaText)
    .replace(/\nenum\s+LicenseType\s+\{[\s\S]*?\n\}/m, "")
    .split(/\r?\n/)
    .map(sqlServerFieldLine)
    .join("\n");
}

/**
 * Rewrite ONLY the `provider = "..."` inside the `datasource db { ... }` block
 * (the generator block's provider is left untouched). Idempotent.
 */
export function applyDbProvider(schemaText, provider) {
  const next = normalizeDbProvider(provider);
  const withProvider = String(schemaText).replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")[^"]*(")/m,
    `$1${next}$2`
  );
  return next === "sqlserver" ? applySqlServerCompatibility(withProvider) : withProvider;
}

// Run as a script: write prisma/schema.active.prisma from DATABASE_PROVIDER.
if (process.argv[1] && process.argv[1].endsWith("set-db-provider.mjs")) {
  const schemaPath = fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url));
  const activeSchemaPath = fileURLToPath(new URL("../prisma/schema.active.prisma", import.meta.url));
  const provider = normalizeDbProvider(process.env.DATABASE_PROVIDER);
  const before = readFileSync(schemaPath, "utf8");
  const after = applyDbProvider(before, provider);
  writeFileSync(activeSchemaPath, after);
  console.log(`[set-db-provider] datasource provider = ${provider}; wrote prisma/schema.active.prisma`);
}
