import { describe, it, expect } from "vitest";
import {
  createItemSummary,
  hasValidSummary,
  describeStatus,
  extractTextForSummary
} from "./itemSummary.js";

// §1738 - Tests for the itemSummary pure model

describe("createItemSummary", () => {
  it("applies defaults for all optional fields", () => {
    const s = createItemSummary({ itemId: "abc" });
    expect(s.itemId).toBe("abc");
    expect(s.id).toBe("sum_abc");
    expect(s.language).toBe("ar");
    expect(s.model).toBe("");
    expect(s.status).toBe("pending");
    expect(s.keyPoints).toEqual([]);
    expect(s.shortSummary).toBe("");
    expect(s.detailedSummary).toBe("");
  });

  it("generates id from itemId when id is omitted", () => {
    const s = createItemSummary({ itemId: "xyz" });
    expect(s.id).toBe("sum_xyz");
  });

  it("preserves provided id instead of generating one", () => {
    const s = createItemSummary({ itemId: "xyz", id: "custom_id" });
    expect(s.id).toBe("custom_id");
  });

  it("trims whitespace from shortSummary", () => {
    const s = createItemSummary({ itemId: "a", shortSummary: "  hello  " });
    expect(s.shortSummary).toBe("hello");
  });

  it("trims whitespace from detailedSummary", () => {
    const s = createItemSummary({ itemId: "a", detailedSummary: "  details  " });
    expect(s.detailedSummary).toBe("details");
  });

  it("accepts partial with all fields provided", () => {
    const now = new Date().toISOString();
    const s = createItemSummary({
      id: "sum_1",
      itemId: "1",
      shortSummary: "brief",
      keyPoints: ["a", "b"],
      detailedSummary: "long text",
      language: "en",
      model: "claude-3",
      status: "done",
      createdAt: now,
      updatedAt: now
    });
    expect(s.keyPoints).toEqual(["a", "b"]);
    expect(s.language).toBe("en");
    expect(s.model).toBe("claude-3");
    expect(s.status).toBe("done");
  });

  it("defaults keyPoints to [] when not an array", () => {
    const s = createItemSummary({ itemId: "a", keyPoints: null });
    expect(s.keyPoints).toEqual([]);
  });

  it("sets empty string id when itemId is missing", () => {
    const s = createItemSummary({});
    expect(s.id).toBe("");
    expect(s.itemId).toBe("");
  });
});

describe("hasValidSummary", () => {
  it("returns true when status is done and shortSummary is non-empty", () => {
    const s = createItemSummary({ itemId: "a", status: "done", shortSummary: "ok" });
    expect(hasValidSummary(s)).toBe(true);
  });

  it("returns false when status is pending", () => {
    const s = createItemSummary({ itemId: "a", status: "pending", shortSummary: "ok" });
    expect(hasValidSummary(s)).toBe(false);
  });

  it("returns false when status is done but shortSummary is empty", () => {
    const s = createItemSummary({ itemId: "a", status: "done", shortSummary: "" });
    expect(hasValidSummary(s)).toBe(false);
  });

  it("returns false when summary is null", () => {
    expect(hasValidSummary(null)).toBe(false);
  });

  it("returns false when status is error", () => {
    const s = createItemSummary({ itemId: "a", status: "error", shortSummary: "ok" });
    expect(hasValidSummary(s)).toBe(false);
  });
});

describe("describeStatus", () => {
  it("returns جاري... for pending", () => {
    const s = createItemSummary({ itemId: "a", status: "pending" });
    expect(describeStatus(s)).toBe("جاري...");
  });

  it("returns مكتمل for done", () => {
    const s = createItemSummary({ itemId: "a", status: "done" });
    expect(describeStatus(s)).toBe("مكتمل");
  });

  it("returns خطأ for error", () => {
    const s = createItemSummary({ itemId: "a", status: "error" });
    expect(describeStatus(s)).toBe("خطأ");
  });

  it("returns غير متاح when summary is null", () => {
    expect(describeStatus(null)).toBe("غير متاح");
  });

  it("returns غير متاح for unknown status", () => {
    expect(describeStatus({ status: "unknown" })).toBe("غير متاح");
  });
});

describe("extractTextForSummary", () => {
  it("combines title, notes, and transcript text", () => {
    const item = {
      title: "My Video",
      notes: "Some notes",
      transcript: { text: "Transcript content" }
    };
    const text = extractTextForSummary(item);
    expect(text).toContain("My Video");
    expect(text).toContain("Some notes");
    expect(text).toContain("Transcript content");
  });

  it("truncates combined text to 4000 chars", () => {
    const longText = "x".repeat(5000);
    const item = { title: longText, notes: "", transcript: null };
    const text = extractTextForSummary(item);
    expect(text.length).toBe(4000);
  });

  it("handles missing notes gracefully", () => {
    const item = { title: "Title" };
    const text = extractTextForSummary(item);
    expect(text).toBe("Title");
  });

  it("handles missing transcript gracefully", () => {
    const item = { title: "Title", notes: "Notes", transcript: null };
    const text = extractTextForSummary(item);
    expect(text).toBe("Title\n\nNotes");
  });

  it("handles string-style transcript (legacy)", () => {
    const item = { title: "T", transcript: "raw transcript" };
    const text = extractTextForSummary(item);
    expect(text).toContain("raw transcript");
  });

  it("returns empty string when item is null", () => {
    expect(extractTextForSummary(null)).toBe("");
  });

  it("returns empty string when all fields are absent", () => {
    expect(extractTextForSummary({})).toBe("");
  });
});
