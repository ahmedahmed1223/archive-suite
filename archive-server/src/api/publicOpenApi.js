import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const publicOpenApiSpec = require("../../docs/public-api.openapi.json");
