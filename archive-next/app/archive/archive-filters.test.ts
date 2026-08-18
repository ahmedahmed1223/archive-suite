import { describe, expect, test } from "vitest";
import type { ArchiveRecord, SavedSearch } from "@/lib/archive-api";
import {
  getInitialCompletion,
  getInitialItemSize,
  getInitialSortField,
  getInitialStatus,
  getInitialViewMode,
  getRecordSearchText,
  getRecordTime,
  getRecordWorkflowStatus,
  getUniqueValues,
  inferRecordTypeFromFile,
  isSavedArchiveView,
  normalizeText,
  savedArchiveViewFromSearch
} from "./archive-filters";

function record(overrides: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return { id: "rec-1", title: "", ...overrides };
}

describe("normalizeText", () => {
  test("strips Arabic diacritics and normalizes letter variants", () => {
    expect(normalizeText("أَحْمَد")).toBe(normalizeText("احمد"));
    expect(normalizeText("مدرسة")).toBe(normalizeText("مدرسه"));
  });

  test("lowercases and trims", () => {
    expect(normalizeText("  Hello  ")).toBe("hello");
  });

  test("handles non-string input safely", () => {
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("getRecordWorkflowStatus", () => {
  test("defaults to draft when workflowStatus is missing or unrecognized", () => {
    expect(getRecordWorkflowStatus(record())).toBe("draft");
    expect(getRecordWorkflowStatus(record({ workflowStatus: "bogus" }))).toBe("draft");
  });

  test("passes through a known workflow status", () => {
    expect(getRecordWorkflowStatus(record({ workflowStatus: "published" }))).toBe("published");
  });
});

describe("getRecordSearchText", () => {
  test("combines title, description, tags, and metadata into one normalized string", () => {
    const text = getRecordSearchText(record({
      title: "تقرير",
      description: "وصف",
      tags: ["أرشيف"],
      metadata: { note: "ملاحظة" }
    }));
    expect(text).toContain(normalizeText("تقرير"));
    expect(text).toContain(normalizeText("ملاحظة"));
  });
});

describe("inferRecordTypeFromFile", () => {
  test("maps common MIME types to record types", () => {
    expect(inferRecordTypeFromFile(new File([], "a.mp4", { type: "video/mp4" }))).toBe("video");
    expect(inferRecordTypeFromFile(new File([], "a.mp3", { type: "audio/mpeg" }))).toBe("audio");
    expect(inferRecordTypeFromFile(new File([], "a.png", { type: "image/png" }))).toBe("image");
    expect(inferRecordTypeFromFile(new File([], "a.pdf", { type: "application/pdf" }))).toBe("document");
    expect(inferRecordTypeFromFile(new File([], "a.bin", { type: "application/octet-stream" }))).toBe("file");
  });
});

describe("getRecordTime", () => {
  test("reads createdAt or updatedAt and falls back to 0 when absent", () => {
    const withDates = record({ createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect(getRecordTime(withDates, "createdAt")).toBe(new Date("2026-01-01T00:00:00.000Z").getTime());
    expect(getRecordTime(withDates, "updatedAt")).toBe(new Date("2026-02-01T00:00:00.000Z").getTime());
    expect(getRecordTime(record(), "createdAt")).toBe(0);
  });
});

describe("getUniqueValues", () => {
  test("returns sorted unique values for the given key", () => {
    const records = [record({ store: "ب" }), record({ store: "أ" }), record({ store: "ب" })];
    expect(getUniqueValues(records, "store")).toEqual(["أ", "ب"]);
  });
});

describe("getInitial* URL param readers", () => {
  test("getInitialViewMode returns a valid mode from the URL or defaults to grid", () => {
    expect(getInitialViewMode(new URLSearchParams("view=list"))).toBe("list");
    expect(getInitialViewMode(new URLSearchParams("view=not-a-mode"))).toBe("grid");
  });

  test("getInitialItemSize defaults to compact for unknown values", () => {
    expect(getInitialItemSize(new URLSearchParams("size=large"))).toBe("large");
    expect(getInitialItemSize(new URLSearchParams(""))).toBe("compact");
  });

  test("getInitialSortField only accepts createdAt or title, else updatedAt", () => {
    expect(getInitialSortField(new URLSearchParams("sort=title"))).toBe("title");
    expect(getInitialSortField(new URLSearchParams("sort=bogus"))).toBe("updatedAt");
  });

  test("getInitialStatus validates against known workflow statuses", () => {
    expect(getInitialStatus(new URLSearchParams("status=review"))).toBe("review");
    expect(getInitialStatus(new URLSearchParams("status=bogus"))).toBe("all");
  });

  test("getInitialCompletion is true only for completion=incomplete", () => {
    expect(getInitialCompletion(new URLSearchParams("completion=incomplete"))).toBe(true);
    expect(getInitialCompletion(new URLSearchParams(""))).toBe(false);
  });
});

describe("saved-view helpers", () => {
  function savedSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
    return { id: "s1", name: "My view", query: "", filters: {}, createdAt: null, updatedAt: null, ...overrides };
  }

  test("isSavedArchiveView checks the viewKind filter marker", () => {
    expect(isSavedArchiveView(savedSearch({ filters: { viewKind: "archive-view" } }))).toBe(true);
    expect(isSavedArchiveView(savedSearch({ filters: { viewKind: "something-else" } }))).toBe(false);
  });

  test("savedArchiveViewFromSearch fills in defaults for missing filters", () => {
    const view = savedArchiveViewFromSearch(savedSearch({ query: "قناة" }));
    expect(view).toEqual({
      id: "s1",
      name: "My view",
      query: "قناة",
      store: "all",
      type: "all",
      status: "all",
      viewMode: "grid",
      itemSize: "compact",
      sortField: "updatedAt",
      sortDirection: "desc"
    });
  });

  test("savedArchiveViewFromSearch reads through populated filters", () => {
    const view = savedArchiveViewFromSearch(savedSearch({
      filters: { store: "archive-items", type: "video", status: "approved", viewMode: "list", itemSize: "large", sortField: "title", sortDirection: "asc" }
    }));
    expect(view.store).toBe("archive-items");
    expect(view.type).toBe("video");
    expect(view.status).toBe("approved");
    expect(view.viewMode).toBe("list");
    expect(view.itemSize).toBe("large");
    expect(view.sortField).toBe("title");
    expect(view.sortDirection).toBe("asc");
  });
});
