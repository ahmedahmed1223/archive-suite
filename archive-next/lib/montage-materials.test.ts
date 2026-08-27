import { describe, expect, it } from "vitest";
import { deriveMontageMaterials } from "./montage-materials";

describe("deriveMontageMaterials", () => {
  it("deduplicates revision sources while preserving a usable duration", () => {
    expect(deriveMontageMaterials([
      {
        id: "clip-a",
        source: { recordId: "record-1", sourceVersionToken: "v1" },
        sourceIn: 2,
        sourceOut: 8,
      },
      {
        id: "clip-b",
        source: { recordId: "record-1", sourceVersionToken: "v1" },
        sourceIn: 0,
        sourceOut: 4,
      },
    ])).toEqual([{
      id: "record-1:v1",
      name: "record-1",
      durationSeconds: 6,
      source: { recordId: "record-1", sourceVersionToken: "v1" },
    }]);
  });
});
