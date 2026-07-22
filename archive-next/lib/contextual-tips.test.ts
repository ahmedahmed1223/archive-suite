import { describe, expect, test } from "vitest";
import { getPageTips } from "@/lib/contextual-tips";

describe("role-aware contextual tips (V1-306C)", () => {
  test("viewer guidance excludes archive editing instructions", () => {
    const titles = getPageTips("archive", "viewer").map((tip) => tip.title);
    expect(titles).toContain("وضع القراءة");
    expect(titles).not.toContain("تعديل السجلات");
  });

  test("editor guidance includes archive editing instructions", () => {
    const titles = getPageTips("archive", "editor").map((tip) => tip.title);
    expect(titles).toContain("تعديل السجلات");
    expect(titles).not.toContain("وضع القراءة");
  });

  test("shared guidance remains visible to every role", () => {
    expect(getPageTips("archive", "viewer").map((tip) => tip.title)).toContain("السجلات");
    expect(getPageTips("archive", "admin").map((tip) => tip.title)).toContain("السجلات");
  });
});
