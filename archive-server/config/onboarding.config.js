import { FILE_STORE_PROVIDERS } from "../src/files/fileStoreProviders.js";

export const ONBOARDING_CONFIG = Object.freeze({
  backend: "BACKEND",
  serverUrl: "APP_BASE_URL",
  adminUsername: "ADMIN_USERNAME",
  adminPassword: "ADMIN_PASSWORD",
  authSecrets: ["JWT_AUTH_SECRET", "JWT_SECRET"],
  fileStore: "FILE_STORE"
});

export const ONBOARDING_FILE_STORE_PROVIDERS = FILE_STORE_PROVIDERS;
