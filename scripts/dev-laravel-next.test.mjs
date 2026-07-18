import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("canonical dev starts and exposes the Reverb server", async () => {
  const source = await readFile(new URL("./dev-laravel-next.mjs", import.meta.url), "utf8");

  assert.match(source, /-p[\s\S]*8080:8080/);
  assert.match(source, /archive-laravel-e2e-runtime:latest/);
  assert.match(source, /artisan reverb:start/);
  assert.match(source, /db:seed[\s\S]*&& \(php artisan reverb:start[\s\S]*&\) && exec php artisan serve/);
});
