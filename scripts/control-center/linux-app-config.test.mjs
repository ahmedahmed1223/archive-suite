import assert from "node:assert/strict";
import test from "node:test";

import { renderLinuxCaddyfile, renderPhpFpmConfig } from "./linux-app-config.mjs";

test("Linux app config uses POSIX paths for Caddy and a foreground PHP-FPM listener", () => {
  const caddyfile = renderLinuxCaddyfile({ installRoot: "/opt/archive-suite", access: "local" });
  const phpFpm = renderPhpFpmConfig({ installRoot: "/opt/archive-suite" });

  assert.match(caddyfile, /auto_https off/);
  assert.match(caddyfile, /:8443 \{/);
  assert.match(caddyfile, /root \* \/opt\/archive-suite\/app\/laravel\/public/);
  assert.doesNotMatch(caddyfile, /\\/);
  assert.match(phpFpm, /daemonize = no/);
  assert.match(phpFpm, /listen = 127\.0\.0\.1:9000/);
  assert.match(phpFpm, /user = archive/);
  assert.match(phpFpm, /chdir = \/opt\/archive-suite\/app\/laravel/);
});

test("Linux public Caddy config requires a real domain for TLS", () => {
  assert.throws(
    () => renderLinuxCaddyfile({ installRoot: "/opt/archive-suite", access: "public" }),
    /ARCHIVE_NATIVE_DOMAIN/,
  );

  const caddyfile = renderLinuxCaddyfile({ installRoot: "/opt/archive-suite", access: "public", domain: "archive.example.test" });
  assert.match(caddyfile, /^archive\.example\.test \{/);
  assert.doesNotMatch(caddyfile, /auto_https off/);
});
