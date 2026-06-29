import { describe, expect, it } from "vitest";

import { buildConfigView, mergeFileStoreConfig, validateFileStoreConfig } from "../adminConfig.js";

const KINDS = ["disk", "dropbox", "s3", "azure", "gdrive", "ftp", "smb", "sftp", "webdav"];

describe("FileStore admin config", () => {
  it("accepts every supported provider", () => {
    for (const kind of KINDS) {
      expect(validateFileStoreConfig({ kind })).toMatchObject({ kind });
    }
  });

  it("rejects unknown providers", () => {
    expect(() => validateFileStoreConfig({ kind: "magic" })).toThrow(/غير مدعوم/);
  });

  it("preserves stored secrets when an empty value is submitted", () => {
    const result = mergeFileStoreConfig({ fileStore: { sftp: { host: "box", password: "saved" } } }, {
      kind: "sftp",
      sftp: { host: "new-box" }
    });
    expect((result.fileStore as any).sftp).toEqual({ host: "new-box", password: "saved" });
  });

  it("returns readiness and secret flags without returning secret values", () => {
    const view = buildConfigView({
      fileStore: "sftp",
      fileStoreSource: "file",
      fileStoreOptions: { host: "box", username: "archive", password: "hidden", root: "/media" },
      fileStoreProviders: [{ id: "sftp", label: "SFTP / SSH", configured: true, active: true, missingEnv: [] }]
    });
    expect(view.fileStore).toMatchObject({ kind: "sftp", configured: true, active: true, restartRequired: false });
    expect(view.fileStore.config).toMatchObject({ host: "box", username: "archive", root: "/media", hasPassword: true });
    expect(JSON.stringify(view)).not.toContain("hidden");
  });
});
