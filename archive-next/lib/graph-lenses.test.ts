import { describe, expect, it } from "vitest";
import { buildGraphLenses, resolveGraphLens } from "./graph-lenses";

describe("graph type lenses", () => {
  const nodes = [
    { id: "1", type: "فيديو" },
    { id: "2", type: "صورة" },
    { id: "3", type: "فيديو" },
    { id: "4", type: "" },
  ];

  it("builds an all lens followed by types ordered by count", () => {
    expect(buildGraphLenses(nodes)).toEqual([
      { id: "all", label: "كل الأنواع", count: 4 },
      { id: "فيديو", label: "فيديو", count: 2 },
      { id: "record", label: "سجل", count: 1 },
      { id: "صورة", label: "صورة", count: 1 },
    ]);
  });

  it("falls back to all when a saved lens no longer exists", () => {
    const lenses = buildGraphLenses(nodes);
    expect(resolveGraphLens("فيديو", lenses)).toBe("فيديو");
    expect(resolveGraphLens("صوت", lenses)).toBe("all");
    expect(resolveGraphLens(null, lenses)).toBe("all");
  });
});
