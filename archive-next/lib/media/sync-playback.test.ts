import { describe, expect, it } from "vitest";
import { SyncPlaybackController } from "./sync-playback";

describe("SyncPlaybackController", () => {
  it("does nothing while disabled", () => {
    const controller = new SyncPlaybackController();
    expect(controller.onTimeUpdate("a", 10, 0)).toBeNull();
    expect(controller.onPlayPause("a", false)).toBeNull();
  });

  it("seeks the other side once the drift exceeds the threshold", () => {
    const controller = new SyncPlaybackController({ enabled: true, thresholdSeconds: 0.3 });
    expect(controller.onTimeUpdate("a", 5.5, 5.4)).toBeNull(); // within threshold
    expect(controller.onTimeUpdate("a", 5.5, 5.0)).toEqual({ side: "b", type: "seek", time: 5.5 });
    expect(controller.onTimeUpdate("b", 2, 10)).toEqual({ side: "a", type: "seek", time: 2 });
  });

  it("propagates play/pause to the opposite side", () => {
    const controller = new SyncPlaybackController({ enabled: true });
    expect(controller.onPlayPause("a", false)).toEqual({ side: "b", type: "play" });
    expect(controller.onPlayPause("b", true)).toEqual({ side: "a", type: "pause" });
  });

  it("can be toggled on and off at runtime", () => {
    const controller = new SyncPlaybackController({ enabled: false });
    expect(controller.isEnabled()).toBe(false);
    expect(controller.onPlayPause("a", false)).toBeNull();

    controller.setEnabled(true);
    expect(controller.isEnabled()).toBe(true);
    expect(controller.onPlayPause("a", false)).toEqual({ side: "b", type: "play" });

    controller.setEnabled(false);
    expect(controller.onPlayPause("a", false)).toBeNull();
  });

  it("suppresses re-entrant events raised while applying a decided action (no ping-pong)", () => {
    const controller = new SyncPlaybackController({ enabled: true, thresholdSeconds: 0.3 });
    const applied: unknown[] = [];

    // Simulate: A's timeupdate fires -> we decide to seek B -> applying that
    // seek on B synchronously re-fires B's own timeupdate handler. That
    // re-entrant call must be swallowed, or it would immediately decide to
    // seek A back, and so on forever.
    const decision = controller.onTimeUpdate("a", 8, 1);
    expect(decision).not.toBeNull();

    controller.withGuard(() => {
      applied.push(decision);
      // Re-entrant call triggered by setting B's currentTime synchronously.
      const reentrant = controller.onTimeUpdate("b", decision!.time!, 1);
      expect(reentrant).toBeNull();
    });

    // Guard released afterwards -- normal sync resumes for later, distinct events.
    expect(controller.onTimeUpdate("b", 8, 0)).toEqual({ side: "a", type: "seek", time: 8 });
  });

  it("handles interleaved concurrent events from both sides deterministically", () => {
    const controller = new SyncPlaybackController({ enabled: true, thresholdSeconds: 0.3 });

    const events: Array<{ side: "a" | "b"; time: number; other: number }> = [
      { side: "a", time: 1, other: 0 },
      { side: "b", time: 1.05, other: 1 }, // within threshold of a's new time
      { side: "a", time: 3, other: 1.05 },
      { side: "b", time: 3.2, other: 3 },
    ];

    const results = events.map((event) => controller.onTimeUpdate(event.side, event.time, event.other));

    expect(results).toEqual([
      { side: "b", type: "seek", time: 1 },
      null,
      { side: "b", type: "seek", time: 3 },
      null,
    ]);
  });
});
