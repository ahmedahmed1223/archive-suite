// V1-210B: renders the runtime config files the native Windows services need
// to actually start -- assemble.mjs stages the bundle but leaves config/
// empty, and the values here (data-plan endpoint, access mode) are only known
// at install time, not bundle-assembly time. archive-http (Caddy) needs
// config\Caddyfile; archive-worker/archive-reverb/archive-scheduler (Laravel
// artisan) need app\laravel\.env or they fail on boot before doing anything.
import { randomBytes } from "node:crypto";

// Public access (TLS + a real domain) is out of scope for this pass -- fail
// loudly rather than silently produce an unreachable HTTPS config. Local and
// intranet access get plain HTTP on a fixed local port; nothing here opens a
// firewall rule for it (that stays gated on access === "public" upstream).
const LOCAL_HTTP_PORT = 8443;

export function renderCaddyfile({ installRoot, access, domain } = {}) {
  if (access === "public") {
    if (typeof domain !== "string" || !domain.trim()) {
      throw new Error("Public access requires ARCHIVE_NATIVE_DOMAIN to render a Caddyfile with real TLS.");
    }
    return [
      `${domain} {`,
      "\tencode zstd gzip",
      `\t@api path /api/* /storage/*`,
      "\thandle @api {",
      `\t\troot * ${installRoot}\\app\\laravel\\public`,
      "\t\tphp_fastcgi 127.0.0.1:9000",
      "\t\tfile_server",
      "\t}",
      "\thandle {",
      "\t\treverse_proxy 127.0.0.1:3000",
      "\t}",
      "}",
    ].join("\n") + "\n";
  }
  return [
    "{",
    "\tauto_https off",
    "}",
    "",
    `:${LOCAL_HTTP_PORT} {`,
    "\tencode zstd gzip",
    "\t@api path /api/* /storage/*",
    "\thandle @api {",
    `\t\troot * ${installRoot}\\app\\laravel\\public`,
    "\t\tphp_fastcgi 127.0.0.1:9000",
    "\t\tfile_server",
    "\t}",
    "\thandle {",
    "\t\treverse_proxy 127.0.0.1:3000",
    "\t}",
    "}",
  ].join("\n") + "\n";
}

// Laravel throws before doing anything useful without a real APP_KEY --
// generate one fresh per install, same shape `php artisan key:generate`
// produces (base64: + 32 random bytes), never reused or hardcoded.
export function generateAppKey(randomBytesFn = randomBytes) {
  return `base64:${randomBytesFn(32).toString("base64")}`;
}

export function renderLaravelEnv({ appKey, appUrl, dataPlan, dbUsername, dbPassword } = {}) {
  if (!dataPlan?.postgres) throw new Error("renderLaravelEnv requires a resolved data plan.");
  const lines = [
    "APP_NAME=Masar",
    "APP_ENV=production",
    `APP_KEY=${appKey}`,
    "APP_DEBUG=false",
    `APP_URL=${appUrl}`,
    "DB_CONNECTION=pgsql",
    `DB_HOST=${dataPlan.postgres.host}`,
    `DB_PORT=${dataPlan.postgres.port}`,
    `DB_DATABASE=${dataPlan.postgres.database}`,
    `DB_USERNAME=${dbUsername}`,
    `DB_PASSWORD=${dbPassword}`,
    `QUEUE_CONNECTION=${dataPlan.queue}`,
    `CACHE_STORE=${dataPlan.cache}`,
  ];
  if (dataPlan.redis?.enabled) {
    lines.push("REDIS_CLIENT=phpredis", `REDIS_HOST=${dataPlan.redis.host}`, `REDIS_PORT=${dataPlan.redis.port}`);
  }
  return lines.join("\n") + "\n";
}

// Credentials never travel through the data plan (native-data-services.mjs
// deliberately rejects a host string carrying them) -- read them from their
// own env vars, matching the ARCHIVE_NATIVE_POSTGRES_* naming already used
// for the endpoint itself.
export function nativeDbCredentialsFromEnv(env = {}) {
  const username = env.ARCHIVE_NATIVE_POSTGRES_USERNAME;
  const password = env.ARCHIVE_NATIVE_POSTGRES_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}
