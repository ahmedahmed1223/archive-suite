// @ts-nocheck
import { describe, expect, it } from "vitest";

import { createPresetFormState, selectBackendPreset } from "./presetModel.js";

describe("onboarding preset model", () => {
  const preset = {
    backend: "postgres",
    serverUrl: "",
    adminUsername: "admin",
    adminPassword: "Initial-123!",
    fileStore: { active: "s3" }
  };

  it("hydrates the wizard from the server preset", () => {
    expect(createPresetFormState(preset)).toEqual({
      storageChoice: "postgres",
      storageUrl: "",
      cloudUsername: "admin",
      cloudPassword: "Initial-123!",
      fileStoreChoice: "s3"
    });
  });

  it("keeps the public API address when switching cloud backends", () => {
    expect(selectBackendPreset(preset, "pocketbase")).toMatchObject({
      storageChoice: "pocketbase",
      storageUrl: ""
    });
  });

  it("keeps SQL Server as a cloud backend preset", () => {
    expect(selectBackendPreset({ ...preset, backend: "sqlserver" }, "sqlserver")).toMatchObject({
      storageChoice: "sqlserver",
      storageUrl: ""
    });
  });
});

