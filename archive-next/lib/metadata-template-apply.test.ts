import { describe, expect, it } from "vitest";
import type { MetadataTemplate } from "@/lib/archive-api";
import { previewTemplateApplication } from "./metadata-template-apply";

const TEMPLATE = {
  id: "t1",
  typeId: "news",
  departmentId: "news",
  name: "قالب أخبار",
  fields: { description: "خبر عاجل", type: "news" },
  tags: ["عاجل"],
  enabled: true,
  usageRoles: ["editor"],
  currentVersion: 1,
  publishedVersion: 1,
  publishedById: null,
  publishedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z"
} as MetadataTemplate;

describe("metadata template preview (V1-827)", () => {
  it("fills empty fields from the template", () => {
    const result = previewTemplateApplication({ description: "", type: "", tags: [], metadata: {} }, TEMPLATE);
    expect(result.description).toBe("خبر عاجل");
    expect(result.type).toBe("news");
    expect(result.tags).toEqual(["عاجل"]);
  });

  it("never overwrites values the user already entered", () => {
    const result = previewTemplateApplication(
      { description: "وصف المستخدم", type: "custom", tags: ["مخصص"], metadata: {} },
      TEMPLATE
    );
    expect(result.description).toBe("وصف المستخدم");
    expect(result.type).toBe("custom");
    expect(result.tags).toEqual(["مخصص"]);
  });
});
