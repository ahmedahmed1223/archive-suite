import { describe, expect, it } from "vitest";
import {
  filterDismissedRecommendations,
  getRecommendationFeedback,
  setRecommendationFeedback
} from "./recommendationFeedback.js";

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

describe("recommendation feedback", () => {
  it("stores useful/not-useful/dismissed state and filters dismissed suggestions", () => {
    const storage = createMemoryStorage();

    setRecommendationFeedback("detail:link-related-item", "useful", storage);
    setRecommendationFeedback("detail:add-source", "dismissed", storage);

    expect(getRecommendationFeedback(storage)).toMatchObject({
      "detail:link-related-item": { value: "useful" },
      "detail:add-source": { value: "dismissed" }
    });
    expect(filterDismissedRecommendations([
      { key: "detail:link-related-item" },
      { key: "detail:add-source" }
    ], getRecommendationFeedback(storage))).toEqual([
      { key: "detail:link-related-item" }
    ]);
  });
});
