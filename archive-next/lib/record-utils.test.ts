import { describe, expect, test } from "vitest";
import { formatDate, getWorkflowStatusLabels, uniqueSorted } from "./record-utils";

describe("record utilities localization", () => {
  test("returns workflow labels in the selected locale", () => {
    expect(getWorkflowStatusLabels("en").review).toBe("In review");
    expect(getWorkflowStatusLabels("ar").review).toBe("قيد المراجعة");
  });

  test("sorts English values using English collation", () => {
    expect(uniqueSorted(["zebra", "Apple"], "en")).toEqual(["Apple", "zebra"]);
  });

  test("formats dates with the selected locale", () => {
    expect(formatDate("2026-08-14T00:00:00.000Z", "-", "en")).toMatch(/^08\/14\/2026$/);
  });
});
