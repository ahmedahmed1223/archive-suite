import type { ClientErrorLogEntry } from "./client-error-log";

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_THRESHOLD = 5;

export function getErrorWave(
  entries: readonly ClientErrorLogEntry[],
  now = new Date(),
  windowMs = DEFAULT_WINDOW_MS,
  threshold = DEFAULT_THRESHOLD,
) {
  const windowStart = now.getTime() - windowMs;
  const count = entries.reduce((total, entry) => {
    if (entry.severity !== "error") return total;
    const lastSeen = new Date(entry.lastSeenAt).getTime();
    if (!Number.isFinite(lastSeen) || lastSeen < windowStart || lastSeen > now.getTime()) return total;
    return total + Math.max(0, entry.count);
  }, 0);

  return {
    active: count >= threshold,
    count,
    windowMinutes: Math.round(windowMs / 60_000),
  };
}
