import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(process.argv[2] ?? ".env");
if (existsSync(target) && !process.argv.includes("--force")) throw new Error(`${target} already exists; refusing to overwrite`);
const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
const version = process.env.ARCHIVE_VERSION;
if (!version || !/^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Set ARCHIVE_VERSION to the bundle version");
const lines = [
  `ARCHIVE_VERSION=${version}`,
  "POSTGRES_USER=archive",
  "POSTGRES_DB=archive",
  `POSTGRES_PASSWORD=${secret()}`,
  `REDIS_PASSWORD=${secret()}`,
  `LARAVEL_APP_KEY=base64:${randomBytes(32).toString("base64")}`,
  `REVERB_APP_ID=${secret(12)}`,
  `REVERB_APP_KEY=${secret(24)}`,
  `REVERB_APP_SECRET=${secret()}`,
  "ADMIN_EMAIL=admin@localhost",
  `ADMIN_PASSWORD=${secret()}`,
  "DOMAIN=localhost",
  "HTTP_PORT=80",
  "HTTPS_PORT=443",
];
writeFileSync(target, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
process.stdout.write(`Created protected environment file: ${target}\n`);
