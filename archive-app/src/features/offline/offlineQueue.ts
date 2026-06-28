const STORAGE_KEY = "archive-offline-queue";
const MAX_RETRIES = 5;

function readQueue(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(1)));
    } catch {}
  }
}

function makeId(): string {
  return `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueOfflineOp({ type, endpoint, method, body = null }: any): string {
  const entry = {
    id: makeId(),
    type,
    endpoint,
    method: method.toUpperCase(),
    body,
    timestamp: Date.now(),
    retries: 0,
  };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
  return entry.id;
}

export function getOfflineQueue(): any[] {
  return readQueue();
}

export function getOfflineQueueCount(): number {
  return readQueue().length;
}

export function dequeueOfflineOp(id: any): void {
  writeQueue(readQueue().filter((e) => e.id !== id));
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

export function markRetryFailed(id: any): void {
  const next = readQueue()
    .map((e) => e.id !== id ? e : { ...e, retries: e.retries + 1 })
    .filter((e) => e.retries <= MAX_RETRIES);
  writeQueue(next);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

export function clearOfflineQueue(): void {
  writeQueue([]);
  window.dispatchEvent(new CustomEvent("offline-queue-changed"));
}

export async function replayOfflineQueue(fetchFn: typeof fetch = fetch): Promise<{ replayed: number; failed: number }> {
  const queue = readQueue();
  let replayed = 0;
  let failed = 0;
  for (const entry of queue) {
    try {
      const opts: any = { method: entry.method };
      if (entry.body !== null && entry.method !== "GET") {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(entry.body);
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
