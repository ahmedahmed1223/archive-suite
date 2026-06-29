import { describe, expect, it } from "vitest";

import { getPresetConfig } from "../presetConfig.js";

describe("getPresetConfig", () => {
  it("returns same-origin Postgres defaults and the configured admin login", async () => {
    const result = await getPresetConfig({
      env: {
        BACKEND: "postgres",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "Initial-123!",
        JWT_AUTH_SECRET: "auth-secret",
        FILE_STORE: "disk",
        FILE_STORE_DIR: "/files"
      },
      testDatabase: async () => true
    });

    expect(result).toMatchObject({
      backend: "postgres",
      serverUrl: "",
      sameOrigin: true,
      adminUsername: "admin",
      adminPassword: "Initial-123!",
      mustChangePassword: true,
      authConfigured: true,
      database: {
        configured: true,
        reachable: true
      },
      fileStore: {
        active: "disk"
      }
    });
  });
});
