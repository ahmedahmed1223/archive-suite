"use client";

export type QueuedMutation = {
  id: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  createdAt: number;
  retryCount: number;
  lastError?: string;
};

const STORAGE_KEY = "archive-offline-queue";
const MAX_RETRIES = 3;
const QUEUE_VERSION = 1;

let queue: QueuedMutation[] = [];
let listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return [...queue];
}

/** Load queue from localStorage on client startup */
export function loadOfflineQueue() {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as { version: number; items: QueuedMutation[] };
      if (data.version === QUEUE_VERSION) {
        queue = data.items;
      } else {
        queue = [];
      }
    }
  } catch {
    queue = [];
  }
}

/** Save queue to localStorage */
function persistQueue() {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: QUEUE_VERSION,
        items: queue
      })
    );
  } catch {
    // Ignore quota errors
  }
}

/** Add a mutation to the offline queue */
export function queueMutation(
  endpoint: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const mutation: QueuedMutation = {
    id,
    endpoint,
    method,
    body,
    createdAt: Date.now(),
    retryCount: 0
  };

  queue = [...queue, mutation];
  persistQueue();
  emit();
  return id;
}

/** Remove a mutation from the queue */
export function removeMutationFromQueue(id: string) {
  queue = queue.filter((m) => m.id !== id);
  persistQueue();
  emit();
}

/** Update a mutation's retry info */
export function updateMutationRetry(id: string, error?: string) {
  queue = queue.map((m) =>
    m.id === id
      ? { ...m, retryCount: m.retryCount + 1, lastError: error }
      : m
  );
  persistQueue();
  emit();
}

/** Clear the entire queue */
export function clearOfflineQueue() {
  queue = [];
  persistQueue();
  emit();
}

/** Get snapshot of current queue */
export function getOfflineQueue() {
  return getSnapshot();
}

/** Export store methods for use with useSyncExternalStore */
export const offlineQueueStore = {
  subscribe,
  getSnapshot
};

// ponytail: external store pattern using native listeners. No Zustand/Jotai needed for this simple case.
