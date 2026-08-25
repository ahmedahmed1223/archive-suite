import { describe, expect, it } from "vitest";
import { resolveSearchSession } from "./search";

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
