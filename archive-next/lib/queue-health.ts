// V1-760: background queue health assessment (ingest / media / backups).
//
// Two failure modes drive the rules here, and both look green to a naive check:
//
//   * A queue nobody can read. `queueDepth` today is one COUNT(*) over `jobs`;
//     when a per-queue reading is missing, absent data must surface as
//     `unknown`, never as `healthy`. Painting a blind spot green is how an
//     outage stays invisible.
//   * A stalled queue with a shallow backlog. One job wedged for an hour is a
//     dead worker, not a volume problem, so age is judged independently of
//     depth — a depth-only rule would call it healthy.
//
// Thresholds are parameters, not constants: a media transcode queue holding
// jobs for minutes is normal, while the same age on ingest is an incident.

export type QueueStatus = "healthy" | "warning" | "critical" | "unknown";

export type QueueReason = "depth" | "stalled" | "failures" | "unreadable";

export interface QueueSnapshot {
  name: string;
  /** Jobs waiting. null when the reading is unavailable. */
  depth: number | null;
  /** Jobs in the failed table for this queue. null when unavailable. */
  failed: number | null;
  /** Age of the oldest waiting job in seconds. null when unavailable. */
  oldestJobAgeSec: number | null;
}

export interface QueueThresholds {
  warnDepth?: number;
  criticalDepth?: number;
  warnAgeSec?: number;
  criticalAgeSec?: number;
  criticalFailures?: number;
}

export interface QueueHealth {
  name: string;
  status: QueueStatus;
  reasons: QueueReason[];
}

export interface QueuesHealth {
  status: QueueStatus;
  queues: QueueHealth[];
}

const DEFAULTS: Required<QueueThresholds> = {
  warnDepth: 100,
  criticalDepth: 1000,
  warnAgeSec: 300,
  criticalAgeSec: 3600,
  criticalFailures: 10,
};

// Ordering for "which status wins". A known fire outranks a blind spot, which
// in turn outranks anything that merely looks fine — so a summary can never be
// greener than its worst member.
const SEVERITY: Record<QueueStatus, number> = { healthy: 0, warning: 1, unknown: 2, critical: 3 };

function readingOf(value: number | null | undefined): number | null {
  // A negative or non-finite count is a broken reading, not a zero. Coercing it
  // to 0 would invent a healthy queue out of a bug.
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function assessQueue(snapshot: QueueSnapshot, thresholds: QueueThresholds = {}): QueueHealth {
  const limits = { ...DEFAULTS, ...thresholds };
  const depth = readingOf(snapshot?.depth);
  const failed = readingOf(snapshot?.failed);
  const age = readingOf(snapshot?.oldestJobAgeSec);
  const name = snapshot?.name ?? "unknown";

  if (depth === null || failed === null || age === null) {
    return { name, status: "unknown", reasons: ["unreadable"] };
  }

  const critical: QueueReason[] = [];
  const warning: QueueReason[] = [];

  if (depth >= limits.criticalDepth) critical.push("depth");
  else if (depth >= limits.warnDepth) warning.push("depth");

  if (age >= limits.criticalAgeSec) critical.push("stalled");
  else if (age >= limits.warnAgeSec) warning.push("stalled");

  if (failed >= limits.criticalFailures) critical.push("failures");
  else if (failed > 0) warning.push("failures");

  if (critical.length) return { name, status: "critical", reasons: [...critical, ...warning] };
  if (warning.length) return { name, status: "warning", reasons: warning };
  return { name, status: "healthy", reasons: [] };
}

/** Rolls a set of queues up to its worst member — one broken queue is not an average. */
export function assessQueues(snapshots: QueueSnapshot[], thresholds: QueueThresholds = {}): QueuesHealth {
  const queues = (Array.isArray(snapshots) ? snapshots : []).map((snapshot) => assessQueue(snapshot, thresholds));
  // No queues at all means nothing was observed, which is a blind spot rather
  // than a clean bill of health.
  if (!queues.length) return { status: "unknown", queues };
  const status = queues.reduce<QueueStatus>(
    (worst, queue) => (SEVERITY[queue.status] > SEVERITY[worst] ? queue.status : worst),
    "healthy",
  );
  return { status, queues };
}
