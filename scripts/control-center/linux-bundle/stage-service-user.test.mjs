import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureServiceUser } from "./stage-service-user.mjs";
import { LINUX_SERVICE_USER } from "../linux-services.mjs";

test("ensureServiceUser creates the group and user when neither exists", () => {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args[0] === "getent") return { status: 2 }; // getent returns 2 when the entry is absent
    return { status: 0 };
  };

  const result = ensureServiceUser({ run });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.deepEqual(calls[0], ["getent", "passwd", LINUX_SERVICE_USER.name]);
  assert.deepEqual(calls[1], ["groupadd", "--system", LINUX_SERVICE_USER.name]);
  assert.deepEqual(calls[2], ["useradd", "--system", "--gid", LINUX_SERVICE_USER.name, "--home-dir", LINUX_SERVICE_USER.home, "--shell", LINUX_SERVICE_USER.shell, "--no-create-home", LINUX_SERVICE_USER.name]);
});

test("ensureServiceUser is a no-op when the user already exists", () => {
  const calls = [];
  const run = (args) => { calls.push(args); return { status: 0 }; }; // getent success (exists)

  const result = ensureServiceUser({ run });

  assert.equal(result.ok, true);
  assert.equal(result.created, false);
  assert.equal(calls.length, 1);
});
