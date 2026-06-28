import { describe, expect, it } from "vitest";

import {
  createArchiveRouteParams,
  getFilteredArchiveItems,
  parseArchiveRouteParams
} from "./viewModel.js";

describe("archive workflow status filtering", () => {
  const items = [
    { id: "draft-1", title: "مسودة", workflowStatus: "draft", tags: ["جاهز"], updatedAt: "2026-06-10" },
    { id: "review-1", title: "بلا وسوم", tags: [], updatedAt: "2026-06-11" },
    { id: "published-1", title: "منشور", workflowStatus: "published", tags: ["منشور"], updatedAt: "2026-06-09" }
  ];

  it("filters by explicit and derived workflow status", () => {
    expect(getFilteredArchiveItems({ videoItems: items, filterStatus: "review" }).map((item) => item.id))
      .toEqual(["review-1"]);
    expect(getFilteredArchiveItems({ videoItems: items, filterStatus: "published" }).map((item) => item.id))
      .toEqual(["published-1"]);
  });

  it("round-trips the status route parameter", () => {
    const params = createArchiveRouteParams({ filterStatus: "review" });
    expect(params.get("status")).toBe("review");
    expect(parseArchiveRouteParams(params).filterStatus).toBe("review");
  });

  it("supports archive display modes and keeps kanban outside archive", () => {
    expect(parseArchiveRouteParams(new URLSearchParams("view=gallery")).viewMode).toBe("gallery");
    expect(parseArchiveRouteParams(new URLSearchParams("view=kanban")).viewMode).toBe("grid");
    expect(parseArchiveRouteParams(new URLSearchParams("view=masonry")).viewMode).toBe("gallery");
    expect(createArchiveRouteParams({ viewMode: "kanban" }).get("view")).toBeNull();
  });
});
