import { describe, expect, it } from "vitest";
import type { ArchiveType } from "@/lib/archive-api";
import { fieldsForType, mergeVisibleFieldValues } from "./type-field-visibility";

const TYPES: ArchiveType[] = [
  { id: "news", name: "أخبار", fields: [{ name: "المراسل", type: "text" }, { name: "عاجل", type: "boolean" }] },
  { id: "program", name: "برامج", fields: [{ name: "رقم الحلقة", type: "number" }] }
];

describe("type field visibility (V1-863)", () => {
  it("returns the fields defined for the record's type", () => {
    expect(fieldsForType("news", TYPES).map((f) => f.name)).toEqual(["المراسل", "عاجل"]);
  });

  it("returns an empty list for an unknown or missing type", () => {
    expect(fieldsForType("unknown", TYPES)).toEqual([]);
    expect(fieldsForType(undefined, TYPES)).toEqual([]);
  });

  it("merges only visible-field updates, leaving other stored metadata untouched", () => {
    const current = { "المراسل": "قديم", "رقم الحلقة": 3 }; // "رقم الحلقة" belongs to a previous type
    const result = mergeVisibleFieldValues(current, fieldsForType("news", TYPES), {
      "المراسل": "جديد",
      "رقم الحلقة": 99
    });

    expect(result["المراسل"]).toBe("جديد");
    expect(result["رقم الحلقة"]).toBe(3); // untouched — not a "news" field
  });
});
