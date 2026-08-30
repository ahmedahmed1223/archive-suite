import assert from "node:assert/strict";
import test from "node:test";

import {
  validateArchiveMembers,
  validateLinuxPgvector,
  validateLinuxPostgres,
  validateLinuxRedis,
} from "./build.mjs";

test("rejects a traversal member before publishing", () => {
  assert.throws(
    () => validateArchiveMembers(["../escape", "bin/redis-server"]),
    /unsafe path/i,
  );
});

test("accepts and ignores the standard archive root entry", () => {
  assert.deepEqual(
    validateArchiveMembers(["./", "./bin/redis-server"]),
    ["bin/redis-server"],
  );
});

test("accepts standard directory entries", () => {
  assert.deepEqual(
    validateArchiveMembers(["./share/", "./share/extension/vector.control"]),
    ["share", "share/extension/vector.control"],
  );
});

test("requires initdb, pg_ctl, and psql in a Linux PostgreSQL package", () => {
  assert.throws(
    () => validateLinuxPostgres(["bin/initdb", "bin/psql"]),
    /pg_ctl/i,
  );
});

test("requires the pgvector library and extension control file", () => {
  assert.throws(
    () => validateLinuxPgvector(["share/extension/vector.control"]),
    /library/i,
  );
});

test("requires exactly one Redis-compatible server executable", () => {
  assert.throws(
    () => validateLinuxRedis(["bin/redis-server", "tools/redis-server"]),
    /exactly one/i,
  );
});
