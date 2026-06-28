export interface RecoveryEntry {
  id: string;
  operation: string;
  label: string;
  payload: unknown;
  context: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  lastError: string | null;
}

const STORAGE_KEY = "archive.recoveryQueue.v1";
const MAX_ATTEMPTS = 5;

let queue: RecoveryEntry[] = [];
const runners = new Map<string, (payload: unknown, entry: RecoveryEntry) => unknown | Promise<unknown>>();
const listeners = new Set<(snapshot: RecoveryEntry[]) => void>();

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

export function createRecoveryEntry(partial: Partial<RecoveryEntry> = {}): RecoveryEntry {
  return {
    id: partial.id || `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    operation: String(partial.operation || "unknown"),
    label: String(partial.label || partial.operation || "عملية فاشلة"),
    payload: partial.payload ?? null,
    context: partial.context && typeof partial.context === "object" ? { ...partial.context } : {},
    attempts: Number.isFinite(partial.attempts) ? Number(partial.attempts) : 0,
    createdAt: partial.createdAt || new Date().toISOString(),
    lastError: partial.lastError || null
  };
}

export function registerRecoveryRunner(operation: string, runner: unknown) {
  if (operation && typeof runner === "function") runners.set(operation, runner as (payload: unknown, entry: RecoveryEntry) => unknown);
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
    queue = Array.isArray(parsed) ? parsed.map((entry) => createRecoveryEntry(entry)) : [];
  } catch {
    queue = [];
  }
  notify();
  return queue;
}

export function enqueueRecovery(partial: Partial<RecoveryEntry>, storage = defaultStorage()) {
  const entry = createRecoveryEntry(partial);
  queue = [entry, ...queue.filter((existing) => existing.id !== entry.id)];
  persistRecoveryQueue(storage);
  notify();
  return entry;
}

export function listRecovery() {
  return [...queue];
}

export function getRecovery(id: string) {
  return queue.find((entry) => entry.id === id) || null;
}

export function pendingRecoveryCount() {
  return queue.length;
}

export function removeRecovery(id: string, storage = defaultStorage()) {
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

export async function retryRecovery(
  id: string,
  { runner, storage = defaultStorage() }: { runner?: (payload: unknown, entry: RecoveryEntry) => unknown | Promise<unknown>; storage?: Storage | null } = {}
) {
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
          ? { ...current, attempts, lastError: error instanceof Error ? error.message : String(error) }
          : current
      );
      persistRecoveryQueue(storage);
      notify();
    }
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)), exhausted };
  }
}

export async function retryAllRecovery(options: {
  runner?: (payload: unknown, entry: RecoveryEntry) => unknown | Promise<unknown>;
  storage?: Storage | null;
} = {}) {
  const ids = queue.map((entry) => entry.id);
  let succeeded = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await retryRecovery(id, options);
    if (result.ok) succeeded += 1;
    else failed += 1;
  }
  return { succeeded, failed };
}

export function subscribeRecovery(listener: unknown) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener as (snapshot: RecoveryEntry[]) => void);
  return () => listeners.delete(listener as (snapshot: RecoveryEntry[]) => void);
}

export function __resetRecoveryQueueForTests() {
  queue = [];
  runners.clear();
  listeners.clear();
}
