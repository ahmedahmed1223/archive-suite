import { describe, expect, it } from "vitest";
import { DEFAULT_ARCHIVE_TYPES, selectMissingDefaults } from "./default-taxonomy";

describe("selectMissingDefaults", () => {
  it("returns every default when nothing exists yet", () => {
    expect(selectMissingDefaults([])).toEqual([...DEFAULT_ARCHIVE_TYPES]);
  });

  it("never overwrites an existing type id", () => {
    const result = selectMissingDefaults(["news", "program"]);
    expect(result.map((type) => type.id)).not.toContain("news");
    expect(result.map((type) => type.id)).not.toContain("program");
    expect(result).toHaveLength(DEFAULT_ARCHIVE_TYPES.length - 2);
  });

  it("returns nothing when all defaults already exist", () => {
    expect(selectMissingDefaults(DEFAULT_ARCHIVE_TYPES.map((type) => type.id))).toEqual([]);
  });

  it("ships unique ids and non-empty Arabic names with fields", () => {
    const ids = DEFAULT_ARCHIVE_TYPES.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of DEFAULT_ARCHIVE_TYPES) {
      expect(type.name.trim().length).toBeGreaterThan(0);
      expect(type.fields.length).toBeGreaterThan(0);
    }
  });
});
