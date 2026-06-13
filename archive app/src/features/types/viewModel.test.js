import { describe, expect, it } from "vitest";
import { FIELD_TYPE_OPTIONS, createCustomFieldValue } from "./viewModel.js";

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
