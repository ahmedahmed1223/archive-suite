// Unit tests for the deploy-time Prisma provider selector (set-db-provider.mjs).
// Pure string logic — no filesystem, no DB.

import assert from "node:assert/strict";
import { applyDbProvider, normalizeDbProvider, DB_PROVIDERS, DEFAULT_DB_PROVIDER } from "./set-db-provider.mjs";
import { resolvePrismaMigrationsPath } from "../prisma.config.mjs";

const schema = [
  'generator client {',
  '  provider = "prisma-client"',
  '  output   = "../src/generated/prisma"',
  '}',
  '',
  'datasource db {',
  '  // Prisma 7 does not allow env() in provider.',
  '  provider = "postgresql"',
  '}',
  ''
].join("\n");

// normalize: aliases + unknown fallback
assert.equal(normalizeDbProvider("mssql"), "sqlserver");
assert.equal(normalizeDbProvider("MSSQL"), "sqlserver");
assert.equal(normalizeDbProvider("postgres"), "postgresql");
assert.equal(normalizeDbProvider("pg"), "postgresql");
assert.equal(normalizeDbProvider("mysql"), "mysql");
assert.equal(normalizeDbProvider("sqlite"), "sqlite");
assert.equal(normalizeDbProvider("nope"), DEFAULT_DB_PROVIDER);
assert.deepEqual([...DB_PROVIDERS], ["postgresql", "mysql", "sqlite", "sqlserver"]);

// swap targets ONLY the datasource provider, not the generator
for (const engine of DB_PROVIDERS) {
  const out = applyDbProvider(schema, engine);
  assert.match(out, new RegExp(`datasource db \\{[\\s\\S]*provider = "${engine}"`), `${engine} applied to datasource`);
  assert.match(out, /generator client \{[\s\S]*provider = "prisma-client"/, "generator provider untouched");
}

// invalid -> default (postgresql), schema unchanged
assert.equal(applyDbProvider(schema, "bad-engine"), schema);

// idempotent
const mysql = applyDbProvider(schema, "mysql");
assert.equal(applyDbProvider(mysql, "mysql"), mysql);

const sqlServerIncompatibleSchema = [
  schema,
  "model StorageRow {",
  "  data           Json",
  "  lastModifiedBy Json?",
  "  metadata      Json? // inline comment",
  "  embedding      Unsupported(\"vector(1536)\")?",
  "}",
  "model ApiKey {",
  "  scopes String[]",
  "}",
  "model RightsRecord {",
  "  licenseType LicenseType @map(\"license_type\")",
  "  geoRestrictions Json @default(\"[]\") @map(\"geo_restrictions\")",
  "}",
  "enum LicenseType {",
  "  OWNED",
  "}"
].join("\n");
const sqlServerSchema = applyDbProvider(sqlServerIncompatibleSchema, "sqlserver");
assert.match(sqlServerSchema, /provider = "sqlserver"/);
assert.match(sqlServerSchema, /data\s+String @db\.NVarChar\(Max\)/);
assert.match(sqlServerSchema, /lastModifiedBy\s+String\? @db\.NVarChar\(Max\)/);
assert.match(sqlServerSchema, /metadata\s+String\? @db\.NVarChar\(Max\) \/\/ inline comment/);
assert.match(sqlServerSchema, /embedding\s+String\? @db\.NVarChar\(Max\)/);
assert.match(sqlServerSchema, /scopes\s+String @default\("\[\]"\) @db\.NVarChar\(Max\)/);
assert.match(sqlServerSchema, /licenseType\s+String @map\("license_type"\)/);
assert.match(sqlServerSchema, /geoRestrictions\s+String @default\("\[\]"\) @map\("geo_restrictions"\) @db\.NVarChar\(Max\)/);
assert.doesNotMatch(sqlServerSchema, /enum LicenseType/);

assert.equal(resolvePrismaMigrationsPath("postgresql"), "prisma/migrations");
assert.equal(resolvePrismaMigrationsPath("sqlserver"), "prisma/migrations-sqlserver");
assert.equal(resolvePrismaMigrationsPath("mssql"), "prisma/migrations-sqlserver");

console.log("ok: db provider swap (datasource-only, aliases, fallback, idempotent)");
