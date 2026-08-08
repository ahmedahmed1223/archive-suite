// Linux Native runtime configuration. Bundle assembly creates the target
// directories, while install-time configuration supplies the access mode,
// data endpoints, credentials, and fresh Laravel application key.
import { renderLaravelEnv } from "./windows-app-config.mjs";

const LOCAL_HTTP_PORT = 8443;

export function renderLinuxCaddyfile({ installRoot, access, domain } = {}) {
  if (access === "public" && (typeof domain !== "string" || !domain.trim())) {
    throw new Error("Public access requires ARCHIVE_NATIVE_DOMAIN to render a Caddyfile with real TLS.");
  }
  const address = access === "public" ? domain.trim() : `:${LOCAL_HTTP_PORT}`;
  const prefix = access === "public" ? [] : ["{", "\tauto_https off", "}", ""];
  return [
    ...prefix,
    `${address} {`,
    "\tencode zstd gzip",
    "\t@api path /api/* /storage/*",
    "\thandle @api {",
    `\t\troot * ${installRoot}/app/laravel/public`,
    "\t\tphp_fastcgi 127.0.0.1:9000",
    "\t\tfile_server",
    "\t}",
    "\thandle {",
    "\t\treverse_proxy 127.0.0.1:3000",
    "\t}",
    "}",
  ].join("\n") + "\n";
}

export function renderPhpFpmConfig({ installRoot } = {}) {
  return [
    "[global]",
    "daemonize = no",
    `error_log = ${installRoot}/logs/php-fpm.log`,
    "",
    "[archive]",
    "user = archive",
    "group = archive",
    "listen = 127.0.0.1:9000",
    "pm = dynamic",
    "pm.max_children = 8",
    "pm.start_servers = 2",
    "pm.min_spare_servers = 1",
    "pm.max_spare_servers = 3",
    `chdir = ${installRoot}/app/laravel`,
    "clear_env = no",
  ].join("\n") + "\n";
}

export { renderLaravelEnv };
