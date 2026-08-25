import { describe, expect, it } from "vitest";
import { resolveSearchSession, describePreviewForScreenReader } from "./search";

describe("resolveSearchSession (V15-SEARCH-001)", () => {
  it("is deterministic for identical inputs", () => {
    const a = resolveSearchSession({ q: "أخبار", mode: "keyword", type: "video" });
    const b = resolveSearchSession({ q: "أخبار", mode: "keyword", type: "video" });
    expect(a).toBe(b);
  });

  it("normalises case and whitespace so equivalent queries collapse", () => {
    const a = resolveSearchSession({ q: "  News  ", mode: "keyword" });
    const b = resolveSearchSession({ q: "news", mode: "keyword" });
    expect(a).toBe(b);
  });

  it("ignores transient fields like page/cursor", () => {
    const a = resolveSearchSession({ q: "x", mode: "semantic" });
    const b = resolveSearchSession({ q: "x", mode: "semantic" });
    expect(a).toBe(b);
    expect(a).not.toContain("page");
  });

  it("treats type=all as no filter", () => {
    const a = resolveSearchSession({ q: "x", type: "all" });
    const b = resolveSearchSession({ q: "x" });
    expect(a).toBe(b);
  });

  it("orders keys consistently regardless of input order", () => {
    const a = resolveSearchSession({ tag: "breaking", q: "election", mode: "keyword" });
    const b = resolveSearchSession({ mode: "keyword", q: "election", tag: "breaking" });
    expect(a).toBe(b);
    expect(a.indexOf("mode=")).toBeLessThan(a.indexOf("q="));
    expect(a.indexOf("q=")).toBeLessThan(a.indexOf("tag="));
  });

  it("returns empty string for a fully empty query", () => {
    expect(resolveSearchSession({})).toBe("");
  });
});

describe("describePreviewForScreenReader (V15-SEARCH-004)", () => {
  const copy = { untitled: "بدون عنوان", noDescription: "لا وصف", updatedLabel: "محدّث" };

  it("returns null for a null record", () => {
    expect(describePreviewForScreenReader(null, copy)).toBeNull();
  });

  it("falls back to the untitled label and no-description copy", () => {
    const summary = describePreviewForScreenReader({ type: "video" }, copy);
    expect(summary?.title).toBe("بدون عنوان");
    expect(summary?.hasDescription).toBe(false);
    expect(summary?.descriptionSnippet).toBe("لا وصف");
  });

  it("truncates long descriptions to 160 chars with an ellipsis", () => {
    const long = "x".repeat(300);
    const summary = describePreviewForScreenReader({ title: "تقرير", description: long }, copy);
    expect(summary?.descriptionSnippet.length).toBe(160);
    expect(summary?.descriptionSnippet.endsWith("…")).toBe(true);
    expect(summary?.hasDescription).toBe(true);
  });

  it("keeps short descriptions intact", () => {
    const summary = describePreviewForScreenReader({ title: "تقرير", description: "ملخص قصير" }, copy);
    expect(summary?.descriptionSnippet).toBe("ملخص قصير");
  });
});
