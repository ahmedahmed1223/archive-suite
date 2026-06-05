// Tiny in-process pub/sub for realtime sync fan-out. When a client pushes a
// change to /api/sync/push, the server publishes it here and every connected
// SSE client (/api/sync/events) receives it. Single-instance only — a
// multi-instance deploy would back this with Redis pub/sub.

export function createEventBus() {
  const subscribers = new Set();

  return {
    /** Register a listener. Returns an unsubscribe function. */
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    /** Fan a payload out to all current listeners (errors isolated per-listener). */
    publish(payload) {
      for (const listener of subscribers) {
        try { listener(payload); } catch { /* one bad listener never blocks others */ }
      }
    },
    /** Current listener count — useful for tests + diagnostics. */
    get size() { return subscribers.size; }
  };
}
