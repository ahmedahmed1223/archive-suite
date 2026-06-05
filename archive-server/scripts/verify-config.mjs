import assert from "node:assert/strict";

import { generateSecret, buildDatabaseUrl, parseDatabaseUrl, maskDatabaseUrl, isValidDatabaseUrl } from "../src/config/secrets.js";

// Connection-string + secret helpers (shared by setup script, server-config
// layer, and the admin DB API). Pure — no I/O.

let failures = 0;
function run(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { failures += 1; console.error(`not ok - ${name}\n  ${err.message}`); }
}

run("generateSecret is url-safe, sized, and unique", () => {
  const a = generateSecret(32);
  const b = generateSecret(32);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 32);
  assert.notEqual(a, b);
});

run("buildDatabaseUrl encodes parts (incl. special-char password)", () => {
  assert.equal(buildDatabaseUrl({ user: "archive", password: "secret", host: "postgres", port: 5432, database: "archive" }),
    "postgresql://archive:secret@postgres:5432/archive");
  assert.equal(buildDatabaseUrl({ password: "p@ss/word", host: "db", database: "archive" }),
    "postgresql://archive:p%40ss%2Fword@db:5432/archive");
  assert.equal(buildDatabaseUrl({ host: "db", database: "archive", password: "" }),
    "postgresql://archive@db:5432/archive"); // no password segment
  assert.equal(buildDatabaseUrl({ engine: "mysql", user: "u", password: "p", host: "db", database: "archive" }),
    "mysql://u:p@db:3306/archive");
  assert.equal(buildDatabaseUrl({ engine: "sqlite", file: "./archive.sqlite" }),
    "file:./archive.sqlite");
});

run("parseDatabaseUrl round-trips + honors expected engine", () => {
  const parts = parseDatabaseUrl("postgresql://u:p%40ss@host:6543/mydb");
  assert.deepEqual(parts, { engine: "postgresql", user: "u", password: "p@ss", host: "host", port: 6543, database: "mydb" });
  assert.equal(parseDatabaseUrl("postgres://u@h/db").port, 5432); // default port
  assert.equal(parseDatabaseUrl("mysql://u@h/db").engine, "mysql");
  assert.equal(parseDatabaseUrl("mysql://u@h/db", "postgresql"), null);
  assert.deepEqual(parseDatabaseUrl("file:./archive.sqlite", "sqlite"), { engine: "sqlite", file: "./archive.sqlite", database: "./archive.sqlite", host: "", port: null, user: "", password: "" });
  assert.equal(parseDatabaseUrl(""), null);
});

run("maskDatabaseUrl hides the password", () => {
  assert.equal(maskDatabaseUrl("postgresql://archive:supersecret@postgres:5432/archive"),
    "postgresql://archive:***@postgres:5432/archive");
  assert.equal(maskDatabaseUrl("postgresql://archive@postgres:5432/archive"),
    "postgresql://archive@postgres:5432/archive"); // no password → nothing to mask
  assert.equal(maskDatabaseUrl("not-a-url"), "");
});

run("isValidDatabaseUrl requires host + database", () => {
  assert.equal(isValidDatabaseUrl("postgresql://u:p@host:5432/db"), true);
  assert.equal(isValidDatabaseUrl("postgresql://u:p@host:5432/"), false); // no db
  assert.equal(isValidDatabaseUrl("mysql://u@host/db"), true);
  assert.equal(isValidDatabaseUrl("mysql://u@host/db", "postgresql"), false);
  assert.equal(isValidDatabaseUrl("file:./archive.sqlite", "sqlite"), true);
  assert.equal(isValidDatabaseUrl(""), false);
});

process.on("beforeExit", () => {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  else console.log("\nAll config/secrets tests passed.");
});
