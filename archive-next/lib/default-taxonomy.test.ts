import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARCHIVE_TYPES,
  DEFAULT_VOCABULARY_TAGS,
  getDefaultArchiveTypes,
  getDefaultVocabularyTags,
  selectMissingDefaults,
  selectMissingVocabularyTags,
} from "./default-taxonomy";

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

  it("skips existing vocabulary tags case- and whitespace-insensitively", () => {
    const result = selectMissingVocabularyTags([" سياسة ", "رياضة"]);
    expect(result).not.toContain("سياسة");
    expect(result).not.toContain("رياضة");
    expect(result).toHaveLength(DEFAULT_VOCABULARY_TAGS.length - 2);
    expect(selectMissingVocabularyTags(DEFAULT_VOCABULARY_TAGS)).toEqual([]);
  });

  it("ships unique ids and non-empty Arabic names with fields", () => {
    const ids = DEFAULT_ARCHIVE_TYPES.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of DEFAULT_ARCHIVE_TYPES) {
      expect(type.name.trim().length).toBeGreaterThan(0);
      expect(type.fields.length).toBeGreaterThan(0);
    }
  });

  it("returns natural English archive types and fields for the English locale", () => {
    const types = getDefaultArchiveTypes("en");

    expect(types.find((type) => type.id === "news")).toMatchObject({
      name: "News",
      fields: [
        { name: "Correspondent", type: "text" },
        { name: "Location", type: "text" },
        { name: "Event date", type: "date" },
        { name: "Breaking news", type: "boolean" },
      ],
    });
    expect(getDefaultArchiveTypes("ar")).toBe(DEFAULT_ARCHIVE_TYPES);
  });

  it("returns English vocabulary tags for the English locale", () => {
    expect(getDefaultVocabularyTags("en")).toEqual([
      "Politics", "Economy", "Sports", "Culture", "Health", "Education", "Technology",
      "Environment", "Local", "International", "Breaking news", "Exclusive", "Archive", "Live",
    ]);
    expect(getDefaultVocabularyTags("ar")).toBe(DEFAULT_VOCABULARY_TAGS);
  });
});
