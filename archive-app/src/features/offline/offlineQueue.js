/**
 * LocalStorage-backed queue for write operations performed while offline.
 * When connectivity is restored the SW BackgroundSync tag fires; this module
 * is the client-side companion that tracks what needs to be replayed.
 *
 * Entry shape:
 *   { id, type, endpoint, method, body, timestamp, retries }
 */

const STORAGE_KEY = "archive-offline-queue";
const MAX_RETRIES = 5;

/** @typedef {{ id: string, type: string, endpoint: string, method: string, body: *, timestamp: number, retries: number }} QueueEntry */

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded — drop the oldest entry and retry once
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(1)));
    } catch { /* ignore */ }
  }
}

function makeId() {
  return `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Add an operation to the offline queue.
 * @param {{ type: string, endpoint: string, method: string, body?: * }} opts
 * @returns {string} entry id
 */
export function enqueueOfflineOp({ type, endpoint, method, body = null }) {
  const entry = {
    id:        makeId(),
    type,
    endpoint,
    method:    method.toUpperCase(),
    body,
    timestamp: Date.now(),
    retries:   0,
  };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
  return entry.id;
}

/** @returns {QueueEntry[]} */
export function getOfflineQueue() {
  return readQueue();
}

/** @returns {number} */
export function getOfflineQueueCount() {
  return readQueue().length;
}

/**
 * Remove an entry after successful replay.
 * @param {string} id
 */
export function dequeueOfflineOp(id) {
  writeQueue(readQueue().filter((e) => e.id !== id));
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

/**
 * Increment retry count; drop the entry if it exceeds MAX_RETRIES.
 * @param {string} id
 */
export function markRetryFailed(id) {
  const next = readQueue()
    .map((e) => e.id !== id ? e : { ...e, retries: e.retries + 1 })
    .filter((e) => e.retries <= MAX_RETRIES);
  writeQueue(next);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

/** Clear all entries (e.g. on forced reset or logout). */
export function clearOfflineQueue() {
  writeQueue([]);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

/**
 * Replay all queued operations now that the network is available.
 * @param {typeof fetch} [fetchFn] - injectable for tests
 * @returns {Promise<{ replayed: number, failed: number }>}
 */
export async function replayOfflineQueue(fetchFn = fetch) {
  const queue = readQueue();
  let replayed = 0;
  let failed   = 0;
  for (const entry of queue) {
    try {
      const opts = { method: entry.method };
      if (entry.body !== null && entry.method !== "GET") {
        opts.headers = { "Content-Type": "application/json" };
        opts.body    = JSON.stringify(entry.body);
      }
      const res = await fetchFn(entry.endpoint, opts);
      if (res.ok) {
        dequeueOfflineOp(entry.id);
        replayed++;
      } else {
        markRetryFailed(entry.id);
        failed++;
      }
    } catch {
      markRetryFailed(entry.id);
      failed++;
    }
  }
  return { replayed, failed };
}
