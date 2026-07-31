// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyClipboard, clearClipboard, copyFields, getClipboard } from "./metadata-clipboard";

describe("metadata clipboard (V1-852)", () => {
  beforeEach(() => window.localStorage.clear());

  it("copies fields from a source record", () => {
    copyFields("r1", { description: "وصف", type: "video", tags: ["أ", "ب"] });
    const clip = getClipboard();
    expect(clip?.sourceId).toBe("r1");
    expect(clip?.description).toBe("وصف");
    expect(clip?.tags).toEqual(["أ", "ب"]);
  });

  it("copying again replaces the single slot", () => {
    copyFields("r1", { description: "أول" });
    copyFields("r2", { description: "ثاني" });
    expect(getClipboard()?.sourceId).toBe("r2");
    expect(getClipboard()?.description).toBe("ثاني");
  });

  it("clears the clipboard", () => {
    copyFields("r1", { description: "وصف" });
    clearClipboard();
    expect(getClipboard()).toBeNull();
  });

  it("applies only the requested fields onto a target draft", () => {
    copyFields("r1", { description: "وصف منسوخ", type: "video", tags: ["س"] });
    const clip = getClipboard()!;
    const target = { description: "وصف قديم", type: "audio", tags: ["ص"] };

    const result = applyClipboard(target, clip, ["description"]);
    expect(result.description).toBe("وصف منسوخ");
    expect(result.type).toBe("audio");
    expect(result.tags).toEqual(["ص"]);
  });

  it("skips fields the clipboard doesn't have", () => {
    copyFields("r1", { description: "وصف" });
    const clip = getClipboard()!;
    const target = { description: "قديم", type: "audio" };

    const result = applyClipboard(target, clip, ["description", "type"]);
    expect(result.type).toBe("audio");
  });
});
