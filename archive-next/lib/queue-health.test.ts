import { describe, expect, it } from "vitest";

import { assessQueue, assessQueues, type QueueSnapshot } from "./queue-health";

// V1-760: background queue health. The failure mode that matters is a queue
// looking fine because nothing is known about it — silence must never read as
// health — and a stalled queue looking fine because its depth is small.

const snapshot = (overrides: Partial<QueueSnapshot> = {}): QueueSnapshot => ({
  name: "ingest",
  depth: 0,
  failed: 0,
  oldestJobAgeSec: 0,
  ...overrides,
});

describe("assessQueue", () => {
  it("reports an empty queue as healthy", () => {
    expect(assessQueue(snapshot()).status).toBe("healthy");
  });

  it("reports a queue with a small backlog moving normally as healthy", () => {
    expect(assessQueue(snapshot({ depth: 5, oldestJobAgeSec: 30 })).status).toBe("healthy");
  });

  it("warns on a deep backlog", () => {
    const result = assessQueue(snapshot({ depth: 500 }));
    expect(result.status).toBe("warning");
    expect(result.reasons).toContain("depth");
  });

  it("escalates a very deep backlog to critical", () => {
    expect(assessQueue(snapshot({ depth: 5000 })).status).toBe("critical");
  });

  it("flags a stalled queue even when the backlog is tiny", () => {
    // One job stuck for hours is a worker problem, not a volume problem —
    // judging by depth alone would call this healthy.
    const result = assessQueue(snapshot({ depth: 1, oldestJobAgeSec: 7200 }));
    expect(result.status).toBe("critical");
    expect(result.reasons).toContain("stalled");
  });

  it("warns when a job has been waiting longer than the comfortable window", () => {
    const result = assessQueue(snapshot({ depth: 2, oldestJobAgeSec: 400 }));
    expect(result.status).toBe("warning");
    expect(result.reasons).toContain("stalled");
  });

  it("treats any failed job as at least a warning", () => {
    const result = assessQueue(snapshot({ failed: 1 }));
    expect(result.status).toBe("warning");
    expect(result.reasons).toContain("failures");
  });

  it("escalates repeated failures to critical", () => {
    expect(assessQueue(snapshot({ failed: 25 })).status).toBe("critical");
  });

  it("reports unknown — not healthy — when a queue cannot be read", () => {
    // A queue we cannot see is the most dangerous one to paint green.
    const result = assessQueue(snapshot({ depth: null }));
    expect(result.status).toBe("unknown");
    expect(result.reasons).toContain("unreadable");
  });

  it("treats a negative or non-finite reading as unreadable rather than as zero", () => {
    expect(assessQueue(snapshot({ depth: -1 })).status).toBe("unknown");
    expect(assessQueue(snapshot({ failed: Number.NaN })).status).toBe("unknown");
  });

  it("keeps the worst reason first when several rules fire", () => {
    const result = assessQueue(snapshot({ depth: 5000, failed: 30, oldestJobAgeSec: 9000 }));
    expect(result.status).toBe("critical");
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("accepts caller thresholds so a slow queue can declare its own normal", () => {
    // A media transcode queue legitimately holds jobs for minutes.
    const result = assessQueue(snapshot({ name: "media", oldestJobAgeSec: 400 }), { warnAgeSec: 1800, criticalAgeSec: 7200 });
    expect(result.status).toBe("healthy");
  });
});

describe("assessQueues", () => {
  it("summarises to the worst queue, because one broken queue is not an average", () => {
    const result = assessQueues([
      snapshot({ name: "ingest" }),
      snapshot({ name: "media", depth: 5000 }),
      snapshot({ name: "backups" }),
    ]);

    expect(result.status).toBe("critical");
    expect(result.queues).toHaveLength(3);
    expect(result.queues.find((queue) => queue.name === "media")?.status).toBe("critical");
    expect(result.queues.find((queue) => queue.name === "ingest")?.status).toBe("healthy");
  });

  it("lets unknown outrank healthy so a blind spot is visible in the summary", () => {
    const result = assessQueues([snapshot({ name: "ingest" }), snapshot({ name: "backups", depth: null })]);
    expect(result.status).toBe("unknown");
  });

  it("lets a real failure outrank an unknown, because a known fire beats a blind spot", () => {
    const result = assessQueues([snapshot({ name: "ingest", depth: null }), snapshot({ name: "media", failed: 30 })]);
    expect(result.status).toBe("critical");
  });

  it("reports unknown for an empty set rather than claiming everything is fine", () => {
    expect(assessQueues([]).status).toBe("unknown");
  });
});
