import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const compose = readFileSync(new URL("../docker-compose.postgres.yml", import.meta.url), "utf8");
const init = readFileSync(new URL("../deploy/pgadmin-init.sh", import.meta.url), "utf8");
const sync = readFileSync(new URL("../deploy/pgadmin-sync-user.py", import.meta.url), "utf8");

assert.match(compose, /pgadmin-init:/);
assert.match(compose, /dpage\/pgadmin4:9\.15/);
assert.doesNotMatch(compose, /dpage\/pgadmin4:latest/);
assert.match(compose, /condition:\s*service_completed_successfully/);
assert.match(compose, /PGPASS_FILE/);
assert.match(init, /pgadmin-sync-user\.py/);
assert.match(sync, /update_user/);
assert.match(sync, /create_user/);
assert.match(init, /POSTGRES_PASSWORD/);
assert.match(init, /storage\/\$USER_CONFIG_DIR\/\.pgpass/);

console.log("ok - pgAdmin init reconciles login and Postgres passfile");
