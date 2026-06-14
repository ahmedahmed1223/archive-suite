/**
 * Recovery queue for failed writes (§1281).
 *
 * When a write/sync operation fails, instead of silently losing it we enqueue
 * a recovery entry describing how to retry it. The queue is persisted so it
 * survives reloads, exposes the pending count for a "عمليات معلقة" banner, and
 * can retry a single entry or all of them.
 *
 * Operations are retried through registered runners keyed by `operation`, so
 * slices register `registerRecoveryRunner("item.write", payload => dbPut(...))`
 * once and any enqueued entry of that type can be replayed.
 */

const STORAGE_KEY = "archive.recoveryQueue.v1";
const MAX_ATTEMPTS = 5;

let queue = [];
const runners = new Map();
const listeners = new Set();

function defaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function notify() {
  const snapshot = listRecovery();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      /* a listener must never break the queue */
    }
  }
}

export function createRecoveryEntry(partial = {}) {
  return {
    id: partial.id || `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    operation: String(partial.operation || "unknown"),
    label: String(partial.label || partial.operation || "عملية فاشلة"),
    payload: partial.payload ?? null,
    context: partial.context && typeof partial.context === "object" ? { ...partial.context } : {},
    attempts: Number.isFinite(partial.attempts) ? partial.attempts : 0,
    createdAt: partial.createdAt || new Date().toISOString(),
    lastError: partial.lastError || null
  };
}

export function registerRecoveryRunner(operation, runner) {
  if (operation && typeof runner === "function") runners.set(operation, runner);
}

export function persistRecoveryQueue(storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* storage may be full or unavailable — non-fatal */
  }
}

export function loadRecoveryQueue(storage = defaultStorage()) {
  if (!storage) return queue;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    queue = Array.isArray(parsed) ? parsed.map(createRecoveryEntry) : [];
  } catch {
    queue = [];
  }
  notify();
  return queue;
}

export function enqueueRecovery(partial, storage = defaultStorage()) {
  const entry = createRecoveryEntry(partial);
  queue = [entry, ...queue.filter((existing) => existing.id !== entry.id)];
  persistRecoveryQueue(storage);
  notify();
  return entry;
}

export function listRecovery() {
  return [...queue];
}

export function getRecovery(id) {
  return queue.find((entry) => entry.id === id) || null;
}

export function pendingRecoveryCount() {
  return queue.length;
}

export function removeRecovery(id, storage = defaultStorage()) {
  const before = queue.length;
  queue = queue.filter((entry) => entry.id !== id);
  if (queue.length !== before) {
    persistRecoveryQueue(storage);
    notify();
    return true;
  }
  return false;
}

export function clearRecovery(storage = defaultStorage()) {
  queue = [];
  persistRecoveryQueue(storage);
  notify();
}

/**
 * Retries a single entry. Uses the provided runner, else the registered runner
 * for the entry's operation. On success the entry is removed; on failure its
 * attempt count and lastError are updated (and it is dropped after MAX_ATTEMPTS).
 * @returns {Promise<{ ok: boolean, error?: Error, exhausted?: boolean }>}
 */
export async function retryRecovery(id, { runner, storage = defaultStorage() } = {}) {
  const entry = getRecovery(id);
  if (!entry) return { ok: false, error: new Error("لا يوجد إدخال للاسترداد") };
  const run = runner || runners.get(entry.operation);
  if (typeof run !== "function") {
    return { ok: false, error: new Error(`لا يوجد مُشغّل للعملية "${entry.operation}"`) };
  }
  try {
    await run(entry.payload, entry);
    removeRecovery(id, storage);
    return { ok: true };
  } catch (error) {
    const attempts = entry.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    if (exhausted) {
      removeRecovery(id, storage);
    } else {
      queue = queue.map((current) =>
        current.id === id
          ? { ...current, attempts, lastError: error?.message || String(error) }
          : current
      );
      persistRecoveryQueue(storage);
      notify();
    }
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)), exhausted };
  }
}

export async function retryAllRecovery(options = {}) {
  const ids = queue.map((entry) => entry.id);
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop -- retries are intentionally sequential
    const result = await retryRecovery(id, options);
    if (result.ok) succeeded += 1;
    else failed += 1;
  }
  return { succeeded, failed };
}

export function subscribeRecovery(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Test-only hook to reset module state between cases.
export function __resetRecoveryQueueForTests() {
  queue = [];
  runners.clear();
  listeners.clear();
}
