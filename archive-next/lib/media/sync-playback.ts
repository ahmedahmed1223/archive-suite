export type PlaybackSide = "a" | "b";

export interface SyncAction {
  side: PlaybackSide;
  type: "seek" | "play" | "pause";
  time?: number;
}

const DEFAULT_THRESHOLD_SECONDS = 0.3;

/**
 * Pure controller for two-way synced playback between two media sides
 * (used by /media/compare's version-compare mode). React (or any other
 * caller) owns the actual <video>/<audio> elements; this class only
 * decides, given a stream of interleaved time/play/pause events from both
 * sides, what the *other* side should be told to do next.
 *
 * The `busy` flag is the concurrency guard: applying a decided action on
 * one side naturally re-fires that side's own time/play event handlers,
 * which would otherwise ping-pong back at the source and could loop
 * indefinitely under rapid, interleaved updates from both players.
 */
export class SyncPlaybackController {
  private enabled: boolean;
  private readonly thresholdSeconds: number;
  private busy = false;

  constructor(options: { enabled?: boolean; thresholdSeconds?: number } = {}) {
    this.enabled = options.enabled ?? false;
    this.thresholdSeconds = options.thresholdSeconds ?? DEFAULT_THRESHOLD_SECONDS;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Call when `side`'s currentTime changes; returns a seek action for the other side, or null. */
  onTimeUpdate(side: PlaybackSide, time: number, otherTime: number): SyncAction | null {
    if (!this.enabled || this.busy) return null;
    if (Math.abs(time - otherTime) <= this.thresholdSeconds) return null;

    return { side: side === "a" ? "b" : "a", type: "seek", time };
  }

  /** Call when `side`'s paused state changes; returns a play/pause action for the other side, or null. */
  onPlayPause(side: PlaybackSide, paused: boolean): SyncAction | null {
    if (!this.enabled || this.busy) return null;

    return { side: side === "a" ? "b" : "a", type: paused ? "pause" : "play" };
  }

  /**
   * Wrap application of a decided action so the re-entrant events it
   * triggers (e.g. setting currentTime fires another timeupdate) are
   * ignored instead of bouncing back and forth between sides.
   */
  withGuard<T>(fn: () => T): T {
    this.busy = true;
    try {
      return fn();
    } finally {
      this.busy = false;
    }
  }
}
