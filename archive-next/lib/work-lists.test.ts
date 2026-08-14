import { describe, expect, it } from "vitest";
import type { ArchiveRecord } from "@/lib/archive-api";
import { getWorkLists, isIncompleteRecord, WORK_LISTS } from "@/lib/work-lists";

function record(descriptorCompletion?: ArchiveRecord["descriptorCompletion"]): ArchiveRecord {
  return { id: "rec-1", title: "مادة", descriptorCompletion } as ArchiveRecord;
}

describe("isIncompleteRecord", () => {
  it("treats a red descriptor completion as incomplete", () => {
    expect(isIncompleteRecord(record({ complete: 1, total: 4, missing: ["description", "type", "tags"], status: "red" }))).toBe(true);
  });

  it("treats a yellow descriptor completion as incomplete", () => {
    expect(isIncompleteRecord(record({ complete: 3, total: 4, missing: ["tags"], status: "yellow" }))).toBe(true);
  });

  it("treats a green descriptor completion as complete", () => {
    expect(isIncompleteRecord(record({ complete: 4, total: 4, missing: [], status: "green" }))).toBe(false);
  });

  it("does not flag a record when the server sent no completion verdict", () => {
    expect(isIncompleteRecord(record(undefined))).toBe(false);
  });
});

describe("WORK_LISTS", () => {
  it("points every work list at an existing route with unique ids", () => {
    const ids = WORK_LISTS.map((list) => list.id);
    expect(new Set(ids).size).toBe(ids.length);
    WORK_LISTS.forEach((list) => {
      expect(list.href.startsWith("/archive") || list.href.startsWith("/rights")).toBe(true);
      expect(list.label.trim()).not.toBe("");
    });
  });

  it("returns English labels and descriptions when English is selected", () => {
    expect(getWorkLists("en")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "incomplete", label: "Records needing description", description: "Records missing a title, description, type, or tags." }),
      expect.objectContaining({ id: "expiring-rights", description: "Rights expiring in 30 days or less." })
    ]));
  });
});
