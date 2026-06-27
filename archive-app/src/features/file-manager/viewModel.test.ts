import { describe, expect, it } from "vitest";

import { buildBreadcrumbs, mergeBrowserEntries, saveViewMode, toggleSelection } from "./viewModel.js";

describe("file manager view model", () => {
  it("builds cumulative breadcrumbs", () => {
    expect(buildBreadcrumbs("incoming/2026/june")).toEqual([
      { label: "الملفات", path: "" },
      { label: "incoming", path: "incoming" },
      { label: "2026", path: "incoming/2026" },
      { label: "june", path: "incoming/2026/june" }
    ]);
  });

  it("merges pagination without duplicate keys", () => {
    expect(mergeBrowserEntries([{ key: "a" }], [{ key: "a", size: 2 }, { key: "b" }])).toEqual([{ key: "a", size: 2 }, { key: "b" }]);
  });

  it("toggles selection and persists only list or grid", () => {
    expect([...toggleSelection(new Set(["a"]), "a")]).toEqual([]);
    const storageValues: Record<string, string> = {};
    const storage = {
      setItem: (key: string, value: string) => { storageValues[key] = value; }
    };
    expect(saveViewMode("grid", storage)).toBe("grid");
    expect(storageValues["archive.fileManager.view"]).toBe("grid");
    expect(saveViewMode("invalid", storage)).toBe("list");
  });
});
