import { describe, expect, it } from "vitest";
import { findCopyQualityIssues, flattenDictionary } from "./copy-quality";

// V1.4 Task 9: the copy quality gate.
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
