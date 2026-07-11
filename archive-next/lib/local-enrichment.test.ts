import { describe, expect, it } from "vitest";
import { deriveLocalSearchEnrichment } from "./local-enrichment";
import type { ArchiveRecord } from "./archive-api";

describe("deriveLocalSearchEnrichment", () => {
  it("extracts local entities and safe tag suggestions without external providers", () => {
    const records: ArchiveRecord[] = [
      {
        id: "clip-001",
        title: "Riyadh archive interview 2026",
        description: "City planning conversation",
        type: "video",
        tags: [],
        workflowStatus: "review"
      },
      {
        id: "clip-002",
        title: "Jeddah sports package",
        description: "Match highlights from the coast",
        type: "video",
        tags: ["city"]
      }
    ];

    const enrichment = deriveLocalSearchEnrichment(records, "city");

    expect(enrichment.mode).toBe("local-rules");
    expect(enrichment.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "place", label: "Riyadh", count: 1 }),
        expect.objectContaining({ kind: "place", label: "Jeddah", count: 1 }),
        expect.objectContaining({ kind: "date", label: "2026", count: 1 })
      ])
    );
    expect(enrichment.suggestedTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "city", count: 1 }),
        expect.objectContaining({ tag: "interview", count: 1 }),
        expect.objectContaining({ tag: "sports", count: 1 })
      ])
    );
    expect(enrichment.coverage.recordsWithoutTags).toBe(1);
  });
});
