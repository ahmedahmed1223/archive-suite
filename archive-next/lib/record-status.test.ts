import { describe, expect, test } from "vitest";
import type { ArchiveRecord } from "./archive-api";
import { deriveRecordStatus, missingDescribeFields } from "./record-status";

function record(overrides: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return { id: "r1", title: "مادة", ...overrides } as ArchiveRecord;
}

const complete = { status: "green", complete: 4, total: 4, missing: [] } as ArchiveRecord["descriptorCompletion"];

describe("deriveRecordStatus (V1-851)", () => {
  test("archived and review come straight from the workflow status", () => {
    expect(deriveRecordStatus(record({ workflowStatus: "archived" })).kind).toBe("archived");
    expect(deriveRecordStatus(record({ workflowStatus: "review" })).kind).toBe("review");
  });

  test("an incomplete descriptor names the missing fields", () => {
    const status = deriveRecordStatus(
      record({ descriptorCompletion: { status: "red", complete: 2, total: 4, missing: ["description", "tags"] } })
    );
    expect(status.kind).toBe("incomplete");
    expect(status.reason).toContain("الوصف");
    expect(status.reason).toContain("الوسوم");
  });

  test("incompleteness outranks a published workflow status", () => {
    const status = deriveRecordStatus(
      record({ workflowStatus: "published", descriptorCompletion: { status: "yellow", complete: 3, total: 4, missing: ["tags"] } })
    );
    expect(status.kind).toBe("incomplete");
  });

  test("a complete draft reads as draft, a complete approved record as ready", () => {
    expect(deriveRecordStatus(record({ workflowStatus: "draft", descriptorCompletion: complete })).kind).toBe("draft");
    expect(deriveRecordStatus(record({ workflowStatus: "approved", descriptorCompletion: complete })).kind).toBe("ready");
  });

  test("missingDescribeFields names each empty field and nothing else (V1-843)", () => {
    expect(missingDescribeFields({ title: "عنوان", description: "وصف", type: "فيديو", tags: ["وسم"] })).toEqual([]);
    expect(missingDescribeFields({ title: "عنوان", description: "  ", type: "", tags: [] })).toEqual([
      "الوصف",
      "النوع",
      "الوسوم"
    ]);
  });

  test("every status carries a non-empty reason", () => {
    const statuses = [
      deriveRecordStatus(record({ workflowStatus: "archived" })),
      deriveRecordStatus(record({ workflowStatus: "review" })),
      deriveRecordStatus(record({ descriptorCompletion: { status: "red", complete: 0, total: 4, missing: [] } })),
      deriveRecordStatus(record({ workflowStatus: "draft" })),
      deriveRecordStatus(record({ workflowStatus: "approved", descriptorCompletion: complete }))
    ];
    statuses.forEach((status) => expect(status.reason.trim().length).toBeGreaterThan(0));
  });
});
