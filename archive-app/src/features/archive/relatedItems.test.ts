import { describe, expect, it } from "vitest";
import { getArchiveImprovementSuggestions, getItemImprovementSuggestions, getRelatedItems } from "./relatedItems.js";

describe("related content suggestions", () => {
  it("suggests relation, tags, and source improvements from similar items", () => {
    const item = {
      id: "focus",
      title: "مقابلة بلا تصنيف",
      type: "interview",
      subtype: "remote",
      tags: [],
      metadata: {}
    };
    const allItems = [
      item,
      { id: "peer-1", title: "مقابلة سياسية", type: "interview", subtype: "remote", tags: ["سياسة", "أرشيف"], path: "a.mp4", updatedAt: "2026-01-03" },
      { id: "peer-2", title: "مقابلة تاريخية", type: "interview", subtype: "remote", tags: ["سياسة"], path: "b.mp4", updatedAt: "2026-01-02" },
      { id: "other", title: "خبر", type: "news", tags: ["رياضة"], path: "c.mp4" }
    ];

    const relatedItems = getRelatedItems(item, allItems, { limit: 3 });
    const suggestions = getItemImprovementSuggestions(item, allItems, {
      relatedItems,
      explicitRelationIds: [],
      limit: 5
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      "link-related-item",
      "add-peer-tags",
      "add-source"
    ]);
    expect(suggestions[0]).toMatchObject({
      severity: "high",
      targetItemId: "peer-1"
    });
    expect(suggestions[1].suggestedTags).toEqual(["سياسة", "أرشيف"]);
  });

  it("summarizes archive-level improvement suggestions for the dashboard", () => {
    const suggestions = getArchiveImprovementSuggestions([
      { id: "a", title: "A", tags: [], metadata: {} },
      { id: "b", title: "B", tags: ["مهم"], path: "b.mp4", metadata: {} }
    ], { contentTypes: [], limit: 5 });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      "dashboard-missing-tags",
      "dashboard-missing-source",
      "dashboard-content-types"
    ]);
    expect(suggestions[0].detail).toContain("1");
  });
});
