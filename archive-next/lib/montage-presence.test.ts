import { describe, expect, it } from "vitest";
import {
  buildPresenceSnapshot,
  clampProgress,
  hasOtherLiveEditor,
  PRESENCE_TTL_MS,
} from "./montage-presence";

describe("montage presence + render progress (Task 6 step 4)", () => {
  const now = 1_000_000;

  it("drops heartbeats older than the TTL and keeps fresh ones", () => {
    const snap = buildPresenceSnapshot(
      "p1",
      [
        { userId: "a", displayName: "أحمد", lastSeenAt: now },
        { userId: "b", displayName: "سارة", lastSeenAt: now - PRESENCE_TTL_MS - 1 },
      ],
      now,
    );
    expect(snap.editors.map((e) => e.userId)).toEqual(["a"]);
    expect(snap.editors[0].stale).toBe(false);
  });

  it("flags another live editor so the UI can warn before overwrite", () => {
    const snap = buildPresenceSnapshot("p1", [
      { userId: "a", displayName: "أحمد", lastSeenAt: now, editingRevision: 3 },
    ], now);
    expect(hasOtherLiveEditor(snap, "a")).toBe(false);
    expect(hasOtherLiveEditor(snap, "me")).toBe(true);
  });

  it("clamps render progress into 0..100 regardless of backend noise", () => {
    expect(clampProgress(-5)).toBe(0);
    expect(clampProgress(140)).toBe(100);
    expect(clampProgress("nope")).toBe(0);
    expect(clampProgress(42.6)).toBe(43);
  });

  it("returns an empty, sane snapshot for no heartbeats", () => {
    const snap = buildPresenceSnapshot("p1", [], now);
    expect(snap.editors).toEqual([]);
    expect(hasOtherLiveEditor(snap, "anyone")).toBe(false);
  });
});
