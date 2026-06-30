// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  FIELD_TYPE_OPTIONS,
  createCustomFieldValue,
  normalizeShowWhen,
  isFieldVisible
} from "./viewModel.js";

describe("custom metadata field types", () => {
  it("allows user-defined multi-select list fields", () => {
    expect(FIELD_TYPE_OPTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "multiselect" })
    ]));

    expect(createCustomFieldValue({
      label: "المنصات",
      type: "multiselect",
      options: "يوتيوب، تيك توك"
    })).toMatchObject({
      label: "المنصات",
      type: "multiselect",
      options: ["يوتيوب", "تيك توك"]
    });
  });
});

describe("relation field type", () => {
  it("is registered in FIELD_TYPE_OPTIONS", () => {
    expect(FIELD_TYPE_OPTIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "relation" })
    ]));
  });

  it("createCustomFieldValue accepts relation type", () => {
    const field = createCustomFieldValue({ label: "العنصر المرتبط", type: "relation" });
    expect(field.type).toBe("relation");
    expect(field.label).toBe("العنصر المرتبط");
  });

  it("unknown type falls back to text, but relation is known", () => {
    const field = createCustomFieldValue({ label: "x", type: "relation" });
    // should NOT fall back to "text"
    expect(field.type).toBe("relation");
  });
});

describe("normalizeShowWhen — shape and round-trip", () => {
  it("returns null for missing input", () => {
    expect(normalizeShowWhen(null)).toBeNull();
    expect(normalizeShowWhen(undefined)).toBeNull();
    expect(normalizeShowWhen("")).toBeNull();
  });

  it("returns null if fieldKey is empty", () => {
    expect(normalizeShowWhen({ fieldKey: "", equals: "yes" })).toBeNull();
    expect(normalizeShowWhen({ equals: "yes" })).toBeNull();
  });

  it("normalizes a valid showWhen object", () => {
    const result = normalizeShowWhen({ fieldKey: "status", equals: "published" });
    expect(result).toEqual({ fieldKey: "status", equals: "published" });
  });

  it("preserves equals=false (boolean) without coercing to empty", () => {
    const result = normalizeShowWhen({ fieldKey: "active", equals: false });
    expect(result).toEqual({ fieldKey: "active", equals: false });
  });

  it("defaults equals to empty string when omitted", () => {
    const result = normalizeShowWhen({ fieldKey: "status" });
    expect(result).toEqual({ fieldKey: "status", equals: "" });
  });

  it("round-trips: builder output → normalizeShowWhen → unchanged", () => {
    // Simulates what ShowWhenBuilder serializes
    const builderOutput = { fieldKey: "reviewStatus", equals: "معتمد" };
    expect(normalizeShowWhen(builderOutput)).toEqual(builderOutput);
  });

  it("strips whitespace from fieldKey", () => {
    const result = normalizeShowWhen({ fieldKey: "  status  ", equals: "x" });
    expect(result).toEqual({ fieldKey: "status", equals: "x" });
  });
});

describe("isFieldVisible with showWhen shape", () => {
  const field = (showWhen) => ({ showWhen });

  it("always visible when showWhen is null", () => {
    expect(isFieldVisible(field(null), {})).toBe(true);
  });

  it("visible when metadata matches equals", () => {
    expect(isFieldVisible(
      field({ fieldKey: "status", equals: "published" }),
      { status: "published" }
    )).toBe(true);
  });

  it("hidden when metadata does not match equals", () => {
    expect(isFieldVisible(
      field({ fieldKey: "status", equals: "published" }),
      { status: "draft" }
    )).toBe(false);
  });

  it("visible when array field contains the expected value", () => {
    expect(isFieldVisible(
      field({ fieldKey: "tags", equals: "news" }),
      { tags: ["news", "live"] }
    )).toBe(true);
  });

  it("hidden when array field does not contain expected value", () => {
    expect(isFieldVisible(
      field({ fieldKey: "tags", equals: "sports" }),
      { tags: ["news", "live"] }
    )).toBe(false);
  });

  it("boolean field: matches when string coercion equals", () => {
    expect(isFieldVisible(
      field({ fieldKey: "active", equals: "true" }),
      { active: true }
    )).toBe(true);
  });
});
