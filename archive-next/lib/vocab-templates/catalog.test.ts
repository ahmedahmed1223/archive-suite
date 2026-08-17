import { describe, expect, it } from "vitest";
import { getVocabTemplateCatalog, VOCAB_TEMPLATE_KEYS } from "./catalog";

describe("getVocabTemplateCatalog", () => {
  it("ships one entry per declared template key, in both locales", () => {
    for (const locale of ["ar", "en"] as const) {
      const catalog = getVocabTemplateCatalog(locale);
      expect(catalog.map((entry) => entry.key).sort()).toEqual([...VOCAB_TEMPLATE_KEYS].sort());
    }
  });

  it("gives every type a unique id across the catalog", () => {
    const ids = getVocabTemplateCatalog("ar").map((entry) => entry.type.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps type ids identical between Arabic and English so plans line up regardless of locale", () => {
    const arIds = getVocabTemplateCatalog("ar").map((entry) => entry.type.id).sort();
    const enIds = getVocabTemplateCatalog("en").map((entry) => entry.type.id).sort();
    expect(enIds).toEqual(arIds);
  });

  it("gives every type and its fields a non-empty localized name", () => {
    for (const locale of ["ar", "en"] as const) {
      for (const entry of getVocabTemplateCatalog(locale)) {
        expect(entry.type.name.trim().length).toBeGreaterThan(0);
        expect(entry.type.fields.length).toBeGreaterThan(0);
        for (const field of entry.type.fields) {
          expect(field.name.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("points each metadata template at its own type", () => {
    for (const entry of getVocabTemplateCatalog("ar")) {
      expect(entry.metadataTemplate.typeId).toBe(entry.type.id);
      expect(entry.metadataTemplate.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("lists every tag's parent before the tag itself, so applying in array order never skips a missing parent", () => {
    for (const locale of ["ar", "en"] as const) {
      for (const entry of getVocabTemplateCatalog(locale)) {
        const seen = new Set<string>();
        for (const node of entry.tags) {
          if (node.parent !== "") {
            expect(seen.has(node.parent)).toBe(true);
          }
          seen.add(node.tag);
        }
      }
    }
  });

  it("declares at least one root tag per template", () => {
    for (const entry of getVocabTemplateCatalog("ar")) {
      expect(entry.tags.some((node) => node.parent === "")).toBe(true);
    }
  });
});
