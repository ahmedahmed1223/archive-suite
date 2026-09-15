import { describe, expect, test } from "vitest";
import { BADGE_TONE_CLASS, badgeClass, describeCompletionTone, recordStatusTone } from "./badge-tone";
import type { RecordStatusKind } from "./record-status";

describe("badge tone mapping", () => {
  test("every record status kind resolves to a known tone", () => {
    const kinds: RecordStatusKind[] = ["archived", "review", "incomplete", "draft", "ready"];
    for (const kind of kinds) {
      expect(Object.keys(BADGE_TONE_CLASS)).toContain(recordStatusTone(kind));
    }
  });

  test("draft is amber, complete is green, so status is scannable at a glance", () => {
    expect(recordStatusTone("draft")).toBe("warning");
    expect(recordStatusTone("incomplete")).toBe("warning");
    expect(recordStatusTone("ready")).toBe("success");
    expect(describeCompletionTone("green")).toBe("success");
    expect(describeCompletionTone("red")).toBe("danger");
  });

  test("neutral keeps the plain grey badge, so type/store badges stay uncoloured", () => {
    expect(badgeClass("neutral")).toBe("badge");
    expect(badgeClass("danger")).toBe("badge badge-danger");
  });
});
