import { describe, expect, it } from "vitest";
import type { ArchiveRecord } from "@/lib/archive-api";
import { buildDuplicateDraftPayload } from "./record-duplicate";

const RECORD = {
  id: "r1",
  title: "مقابلة أصلية",
  description: "وصف",
  type: "video",
  tags: ["أرشيف"],
  metadata: { location: "القاهرة" }
} as unknown as ArchiveRecord;

describe("record duplicate as draft (V1-831)", () => {
  it("prefixes the title to signal it is a copy", () => {
    const payload = buildDuplicateDraftPayload(RECORD);
    expect(payload.title).toBe("نسخة من مقابلة أصلية");
  });

  it("copies description, type, and tags", () => {
    const payload = buildDuplicateDraftPayload(RECORD);
    expect(payload.description).toBe("وصف");
    expect(payload.type).toBe("video");
    expect(payload.tags).toEqual(["أرشيف"]);
  });

  it("records the source id in metadata for audit, alongside existing metadata", () => {
    const payload = buildDuplicateDraftPayload(RECORD);
    expect(payload.metadata?.duplicatedFrom).toBe("r1");
    expect(payload.metadata?.location).toBe("القاهرة");
  });

  it("never includes files, share links, or rights fields", () => {
    const payload = buildDuplicateDraftPayload(RECORD);
    expect(payload).not.toHaveProperty("files");
    expect(payload).not.toHaveProperty("shareLinks");
    expect(payload).not.toHaveProperty("rights");
  });
});
