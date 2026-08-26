import { describe, expect, it } from "vitest";
import {
  deriveMediaWorkActions,
  isMediaWorkBlocked,
  mediaWorkGroupLabel,
  type MediaWorkItem,
} from "./media-work-inbox";

function item(over: Partial<MediaWorkItem>): MediaWorkItem {
  return {
    id: "e1",
    source: "export",
    status: "processing",
    progress: 40,
    label: "تصدير ويب 1080p",
    canRetry: false,
    canCancel: true,
    ...over,
  };
}

describe("media work inbox rows (Task 7)", () => {
  it("treats a failed export as blocked, never complete", () => {
    expect(isMediaWorkBlocked(item({ status: "failed" }))).toBe(true);
    expect(isMediaWorkBlocked(item({ status: "completed" }))).toBe(false);
  });

  it("offers one safe retry for a failed export the actor may retry", () => {
    const actions = deriveMediaWorkActions(
      item({ status: "failed", canRetry: true, href: "/media/studio?projectId=p1" }),
    );
    expect(actions).toEqual(["retry", "open"]);
  });

  it("hides retry when the server denies it (viewer on someone else's export)", () => {
    const actions = deriveMediaWorkActions(item({ status: "failed", canRetry: false }));
    expect(actions).not.toContain("retry");
  });

  it("allows cancel only while queued or processing", () => {
    expect(deriveMediaWorkActions(item({ status: "queued" }))).toContain("cancel");
    expect(deriveMediaWorkActions(item({ status: "completed", canCancel: true }))).not.toContain("cancel");
  });

  it("groups failures under an attention label", () => {
    expect(mediaWorkGroupLabel("failed")).toMatch(/فشل/);
    expect(mediaWorkGroupLabel("processing")).toMatch(/المعالجة/);
    expect(mediaWorkGroupLabel("completed")).toMatch(/مكتملة/);
  });
});
