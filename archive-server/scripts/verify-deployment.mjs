import assert from "node:assert/strict";

import { assertProductionSecrets, isPublicProduction } from "../src/config/productionGuard.js";

assert.equal(isPublicProduction({ ARCHIVE_PUBLIC_DEPLOY: "1" }), true);
assert.equal(isPublicProduction({ NODE_ENV: "production" }), true);
assert.equal(isPublicProduction({ ARCHIVE_PUBLIC_DEPLOY: "0", NODE_ENV: "development" }), false);
assert.equal(isPublicProduction({}), false);

assert.doesNotThrow(() => assertProductionSecrets({ ARCHIVE_PUBLIC_DEPLOY: "0" }));
assert.doesNotThrow(() => assertProductionSecrets({
  ARCHIVE_PUBLIC_DEPLOY: "1",
  JWT_SECRET: "x".repeat(48),
  ADMIN_PASSWORD: "StrongPassword-123"
}));

assert.throws(
  () => assertProductionSecrets({ ARCHIVE_PUBLIC_DEPLOY: "1", JWT_SECRET: "", ADMIN_PASSWORD: "" }),
  /JWT_SECRET.*ADMIN_PASSWORD/
);

assert.throws(
  () => assertProductionSecrets({ NODE_ENV: "production", JWT_SECRET: "x".repeat(48), ADMIN_PASSWORD: "" }),
  /ADMIN_PASSWORD/
);

console.log("ok - deployment production guard");
