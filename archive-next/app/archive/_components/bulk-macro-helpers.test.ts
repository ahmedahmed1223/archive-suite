import { describe, expect, test } from "vitest";
import { selectedBulkMacroTargets } from "./bulk-macro-helpers";

describe("selectedBulkMacroTargets", () => {
  test("derives unique explicit store/id targets from the current selection", () => {
    expect(selectedBulkMacroTargets([{ id: "1", title: "أ", store: "main" }, { id: "1", title: "ب", store: "other" }, { id: "2", title: "ج" }], ["1", "2"]))
      .toEqual([{ store: "main", id: "1" }, { store: "other", id: "1" }]);
  });
});
