import { describe, expect, it } from "vitest";
import type { RecordAttachment, RightsRecord } from "@/lib/archive-api";
import { buildSafetyAlerts } from "./record-safety-alerts";

function attachment(overrides: Partial<RecordAttachment>): RecordAttachment {
  return {
    id: "a1",
    checksumSha256: "sum1",
    isPrimary: false,
    mimeType: "video/mp4",
    originalName: "clip.mp4",
    processingStatus: "ready",
    recordStore: "archive-items",
    recordUid: "r1",
    sizeBytes: 100,
    ...overrides
  } as RecordAttachment;
}

describe("record safety alerts (V1-830)", () => {
  it("flags attachments sharing the same checksum", () => {
    const alerts = buildSafetyAlerts({
      attachments: [attachment({ id: "a1", checksumSha256: "sum1" }), attachment({ id: "a2", checksumSha256: "sum1" })],
      rights: null
    });
    expect(alerts.filter((a) => a.kind === "checksum-duplicate")).toHaveLength(1);
  });

  it("uses English alert text when English is selected", () => {
    const alerts = buildSafetyAlerts({
      attachments: [attachment({ id: "a1", checksumSha256: "sum1" }), attachment({ id: "a2", checksumSha256: "sum1" })],
      rights: null
    }, "en");
    expect(alerts[0]?.message).toBe("2 attachments share the same checksum: clip.mp4, clip.mp4.");
  });

  it("does not flag attachments with distinct checksums", () => {
    const alerts = buildSafetyAlerts({
      attachments: [attachment({ id: "a1", checksumSha256: "sum1" }), attachment({ id: "a2", checksumSha256: "sum2" })],
      rights: null
    });
    expect(alerts).toHaveLength(0);
  });

  it("flags expired rights", () => {
    const rights = { id: "rt1", itemId: "r1", rightsHolder: "x", licenseType: "OWNED", expiresAt: "2020-01-01T00:00:00Z" } as RightsRecord;
    const alerts = buildSafetyAlerts({ attachments: [], rights, now: new Date("2026-01-01") });
    expect(alerts.filter((a) => a.kind === "rights-expired")).toHaveLength(1);
  });

  it("does not flag rights that have not expired yet", () => {
    const rights = { id: "rt1", itemId: "r1", rightsHolder: "x", licenseType: "OWNED", expiresAt: "2099-01-01T00:00:00Z" } as RightsRecord;
    const alerts = buildSafetyAlerts({ attachments: [], rights, now: new Date("2026-01-01") });
    expect(alerts).toHaveLength(0);
  });

  it("flags an attachment whose processing has not completed", () => {
    const alerts = buildSafetyAlerts({ attachments: [attachment({ processingStatus: "failed" })], rights: null });
    expect(alerts.filter((a) => a.kind === "upload-incomplete")).toHaveLength(1);
  });
});
