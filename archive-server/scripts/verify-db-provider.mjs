// Unit tests for the deploy-time Prisma provider selector (set-db-provider.mjs).
// Pure string logic — no filesystem, no DB.

import assert from "node:assert/strict";
import { applyDbProvider, normalizeDbProvider, DB_PROVIDERS, DEFAULT_DB_PROVIDER } from "./set-db-provider.mjs";

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

console.log("ok: db provider swap (datasource-only, aliases, fallback, idempotent)");
