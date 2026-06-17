import { describe, expect, it } from "vitest";

import {
  IMPORT_KINDS,
  buildImportDraft,
  detectImportSource,
  parseImportLines
} from "./importSources.js";

describe("detectImportSource — YouTube", () => {
  it("detects a standard watch URL and extracts the id", () => {
    const result = detectImportSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.kind).toBe(IMPORT_KINDS.YOUTUBE);
    expect(result.id).toBe("dQw4w9WgXcQ");
  });

  it("detects a youtu.be short link", () => {
    const result = detectImportSource("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toMatchObject({ kind: IMPORT_KINDS.YOUTUBE, id: "dQw4w9WgXcQ" });
  });

  it("detects a shorts URL", () => {
    const result = detectImportSource("https://youtube.com/shorts/dQw4w9WgXcQ");
    expect(result).toMatchObject({ kind: IMPORT_KINDS.YOUTUBE, id: "dQw4w9WgXcQ" });
  });

  it("detects an embed URL", () => {
    const result = detectImportSource("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).toMatchObject({ kind: IMPORT_KINDS.YOUTUBE, id: "dQw4w9WgXcQ" });
  });

  it("keeps extra query params but still extracts the id", () => {
    const result = detectImportSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc");
    expect(result.id).toBe("dQw4w9WgXcQ");
  });

  it("falls back to web for a youtube host without a valid id", () => {
    const result = detectImportSource("https://www.youtube.com/feed/subscriptions");
    expect(result.kind).toBe(IMPORT_KINDS.WEB);
  });
});

describe("detectImportSource — Google Drive", () => {
  it("detects the /file/d/<id> form", () => {
    const result = detectImportSource("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H/view");
    expect(result).toMatchObject({ kind: IMPORT_KINDS.GOOGLE_DRIVE, id: "1A2B3C4D5E6F7G8H" });
  });

  it("detects the open?id= form", () => {
    const result = detectImportSource("https://drive.google.com/open?id=1A2B3C4D5E6F7G8H");
    expect(result).toMatchObject({ kind: IMPORT_KINDS.GOOGLE_DRIVE, id: "1A2B3C4D5E6F7G8H" });
  });
});

describe("detectImportSource — web and unknown", () => {
  it("classifies a generic https URL as web", () => {
    const result = detectImportSource("https://example.com/article/my-post");
    expect(result.kind).toBe(IMPORT_KINDS.WEB);
    expect(result.normalizedUrl).toContain("example.com");
  });

  it("classifies plain text as unknown", () => {
    const result = detectImportSource("not a url at all");
    expect(result.kind).toBe(IMPORT_KINDS.UNKNOWN);
    expect(result.normalizedUrl).toBe("");
  });

  it("rejects non-http schemes as unknown", () => {
    const result = detectImportSource("javascript:alert(1)");
    expect(result.kind).toBe(IMPORT_KINDS.UNKNOWN);
  });

  it("treats empty input as unknown", () => {
    expect(detectImportSource("").kind).toBe(IMPORT_KINDS.UNKNOWN);
    expect(detectImportSource(undefined).kind).toBe(IMPORT_KINDS.UNKNOWN);
  });
});

describe("parseImportLines", () => {
  it("parses newline-separated links", () => {
    const sources = parseImportLines(
      "https://youtu.be/dQw4w9WgXcQ\nhttps://example.com/a"
    );
    expect(sources).toHaveLength(2);
    expect(sources[0].kind).toBe(IMPORT_KINDS.YOUTUBE);
    expect(sources[1].kind).toBe(IMPORT_KINDS.WEB);
  });

  it("parses comma and whitespace separated links", () => {
    const sources = parseImportLines("https://example.com/a, https://example.com/b https://example.com/c");
    expect(sources).toHaveLength(3);
  });

  it("dedupes by normalized URL", () => {
    const sources = parseImportLines(
      "https://youtu.be/dQw4w9WgXcQ\nhttps://youtu.be/dQw4w9WgXcQ"
    );
    expect(sources).toHaveLength(1);
  });

  it("skips blanks and invalid entries", () => {
    const sources = parseImportLines("\n  \nnot-a-url\nhttps://example.com/ok\n");
    expect(sources).toHaveLength(1);
    expect(sources[0].kind).toBe(IMPORT_KINDS.WEB);
  });

  it("returns an empty array for empty/blank input", () => {
    expect(parseImportLines("")).toEqual([]);
    expect(parseImportLines("   \n  ")).toEqual([]);
  });
});

describe("buildImportDraft", () => {
  it("builds a YouTube draft with a video type and source metadata", () => {
    const draft = buildImportDraft(detectImportSource("https://youtu.be/dQw4w9WgXcQ"));
    expect(draft).toMatchObject({
      title: "YouTube: dQw4w9WgXcQ",
      type: "video",
      metadata: {
        importSource: IMPORT_KINDS.YOUTUBE,
        sourceId: "dQw4w9WgXcQ"
      }
    });
    expect(draft.path).toContain("youtu.be");
    expect(draft.metadata.sourceUrl).toBe(draft.path);
  });

  it("builds a Google Drive draft referencing the file id", () => {
    const draft = buildImportDraft(detectImportSource("https://drive.google.com/file/d/1A2B3C4D5E6F7G8H/view"));
    expect(draft.title).toBe("Google Drive: 1A2B3C4D5E6F7G8H");
    expect(draft.metadata.sourceId).toBe("1A2B3C4D5E6F7G8H");
  });

  it("builds a web draft with a readable title from the last path segment", () => {
    const draft = buildImportDraft(detectImportSource("https://example.com/blog/my-cool-post"));
    expect(draft.title).toBe("my cool post");
    expect(draft.metadata.importSource).toBe(IMPORT_KINDS.WEB);
    expect(draft.metadata.sourceId).toBeUndefined();
  });

  it("falls back to the host when the web URL has no path", () => {
    const draft = buildImportDraft(detectImportSource("https://example.com/"));
    expect(draft.title).toBe("example.com");
  });

  it("returns null for unknown sources", () => {
    expect(buildImportDraft(detectImportSource("garbage"))).toBeNull();
    expect(buildImportDraft(null)).toBeNull();
  });
});
