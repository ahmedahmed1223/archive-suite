type Listener = (payload: unknown) => void;

interface EventBus {
  subscribe(listener: Listener): () => void;
  publish(payload: unknown): void;
  size: number;
}

export function createEventBus(): EventBus {
  const subscribers = new Set<Listener>();

  return {
    subscribe(listener: Listener): () => void {
      if (typeof listener !== "function") return () => {};
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(payload: unknown): void {
      for (const listener of subscribers) {
        try { listener(payload); } catch { /* one bad listener never blocks others */ }
      }
    },
    get size(): number { return subscribers.size; }
  };
}
