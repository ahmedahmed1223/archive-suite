import { describe, expect, test } from "vitest";
import { bulkMacroReasonLabel, selectedBulkMacroTargets } from "./bulk-macro-helpers";

describe("selectedBulkMacroTargets", () => {
  test("derives unique explicit store/id targets from the current selection", () => {
    expect(selectedBulkMacroTargets([{ id: "1", title: "أ", store: "main" }, { id: "1", title: "ب", store: "other" }, { id: "2", title: "ج" }], ["1", "2"]))
      .toEqual([{ store: "main", id: "1" }, { store: "other", id: "1" }]);
  });
});

test("localizes event dispatch failures without exposing the raw code", () => {
  const label = bulkMacroReasonLabel("event_dispatch_failed");
  expect(label).toBe("تعذر إرسال حدث التغيير");
  expect(label).not.toContain("event_dispatch_failed");
});
