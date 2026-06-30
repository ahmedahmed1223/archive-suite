import { describe, expect, it } from "vitest";

import { formatRecordVersionSummary } from "../userDataRoutes.js";

describe("formatRecordVersionSummary", () => {
  it("converts BigInt ids so record-version responses can be JSON serialized", () => {
    const summary = formatRecordVersionSummary({
      id: 12n,
      version: 3,
      userId: "u1",
      createdAt: new Date("2026-06-30T00:00:00.000Z"),
    });

    expect(summary).toMatchObject({
      id: "12",
      version: 3,
      userId: "u1",
    });
    expect(() => JSON.stringify(summary)).not.toThrow();
  });
});
