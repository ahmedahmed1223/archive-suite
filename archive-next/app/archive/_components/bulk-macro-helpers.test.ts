import { describe, expect, test } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { bulkMacroReasonLabel, bulkMacroStepLabel, bulkMacroValueLabel, selectedBulkMacroTargets } from "./bulk-macro-helpers";

const arabicCopy = getDictionary("ar").pages.bulkMacroRecorder;
const englishCopy = getDictionary("en").pages.bulkMacroRecorder;

describe("selectedBulkMacroTargets", () => {
  test("derives unique explicit store/id targets from the current selection", () => {
    expect(selectedBulkMacroTargets([{ id: "1", title: "أ", store: "main" }, { id: "1", title: "ب", store: "other" }, { id: "2", title: "ج" }], ["1", "2"]))
      .toEqual([{ store: "main", id: "1" }, { store: "other", id: "1" }]);
  });
});

test("localizes event dispatch failures without exposing the raw code", () => {
  const label = bulkMacroReasonLabel("event_dispatch_failed", arabicCopy);
  expect(label).toBe("تعذر إرسال حدث التغيير");
  expect(label).not.toContain("event_dispatch_failed");
});

test("uses the supplied dictionary and locale for labels and numeric values", () => {
  expect(bulkMacroStepLabel({ type: "add-tag", tag: "review" }, englishCopy)).toBe("Add tag: review");
  expect(bulkMacroValueLabel(1234, englishCopy, "en")).toBe(new Intl.NumberFormat("en").format(1234));
  expect(bulkMacroValueLabel(1234, arabicCopy, "ar")).toBe(new Intl.NumberFormat("ar").format(1234));
});
