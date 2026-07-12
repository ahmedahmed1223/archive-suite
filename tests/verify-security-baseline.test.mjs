import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("security baseline succeeds from the current checkout", () => {
  const root = new URL("..", import.meta.url);

  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/verify-security-baseline.mjs"], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe"
    });
  });
});
