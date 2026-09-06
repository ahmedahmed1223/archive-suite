import { describe, expect, test } from "vitest";
import { mediaComparisonHref } from "./media-workspace-links";

describe("mediaComparisonHref", () => {
  test("preserves the record and its non-default store for record-led version comparison", () => {
    expect(mediaComparisonHref("record-42", "news-library")).toBe("/media/compare?recordId=record-42&store=news-library");
  });

  test("keeps the default archive store out of the URL", () => {
    expect(mediaComparisonHref("record-42", "archive-items")).toBe("/media/compare?recordId=record-42");
  });
});
