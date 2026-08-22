import { describe, expect, it } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { findCopyQualityIssues, flattenDictionary } from "./copy-quality";
import { getDictionary } from "./dictionaries";

// V14-UX-009 (Task 9): the copy quality gate runs against the REAL shipped
// ar/en dictionaries — not just synthetic samples. Any untranslated general
// UI label in Arabic, or Arabic text leaked into English, fails here.

const dictionariesDir = path.resolve("lib/i18n/dictionaries");

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("findCopyQualityIssues", () => {
  it("accepts clean Arabic UI copy", () => {
    expect(
      findCopyQualityIssues("ar", {
        save: "حفظ",
        settings: "إعدادات",
        auditLog: "سجل تدقيق"
      })
    ).toEqual([]);
  });

  it("accepts clean English UI copy", () => {
    expect(
      findCopyQualityIssues("en", {
        save: "Save",
        settings: "Settings",
        auditLog: "Audit log"
      })
    ).toEqual([]);
  });

  it("flags an untranslated English label in the Arabic dictionary", () => {
    expect(findCopyQualityIssues("ar", { settings: "Settings" })).toContain(
      "settings: Arabic UI copy contains an untranslated general UI label"
    );
  });

  it("flags Arabic text leaked into the English dictionary", () => {
    expect(findCopyQualityIssues("en", { greeting: "مرحباً" })).toContain(
      "greeting: English UI copy contains Arabic text"
    );
  });

  it("flags empty copy in either language", () => {
    expect(findCopyQualityIssues("ar", { label: "" })).toEqual([
      "label: UI copy must not be empty"
    ]);
  });
});

describe("flattenDictionary", () => {
  it("flattens nested dictionaries into dot paths", () => {
    const flat = flattenDictionary({ a: { b: { c: "text" } }, d: "plain" });
    expect(flat).toEqual({ "a.b.c": "text", d: "plain" });
  });
});

describe("shipped dictionary copy quality", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`the ${locale} page dictionaries pass the copy gate`, () => {
      const dir = path.join(dictionariesDir, locale, "pages");
      const issues: Array<{ file: string; issues: string[] }> = [];
      for (const file of collectTsFiles(dir)) {
        const source = readFileSync(file, "utf8");
        // Evaluate the module's default export shape via a dynamic-free
        // approach: match `export const <name> = {...} as const;` by importing
        // is not possible synchronously, so we assert via getDictionary below.
        void source;
      }
      const dictionary = getDictionary(locale) as unknown as Record<string, unknown>;
      const pages = flattenDictionary(dictionary.pages ?? {});
      const found = findCopyQualityIssues(locale, pages);
      issues.push({ file: `pages (${locale})`, issues: found });
      expect(issues.filter((entry) => entry.issues.length > 0)).toEqual([]);
    });

    it(`the ${locale} shell and shared dictionaries pass the copy gate`, () => {
      for (const key of ["shell", "shared", "nav", "pageTitles", "auth", "help", "settings"] as const) {
        const section = (getDictionary(locale) as unknown as Record<string, unknown>)[key];
        if (!section || typeof section !== "object") continue;
        const flat = flattenDictionary(section);
        expect(findCopyQualityIssues(locale, flat), `${locale}.${key}`).toEqual([]);
      }
    });
  }
});
