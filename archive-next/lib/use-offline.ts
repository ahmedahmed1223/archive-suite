"use client";

import { useSyncExternalStore } from "react";
import { connectivityStore, type ConnectivityStatus } from "./connectivity-probe";
import { offlineQueueStore, type QueuedMutation } from "./offline-queue";

/**
 * Hook to get the current connectivity status
 *
 * @returns "online" | "offline" | "degraded"
 */
export function useConnectivity(): ConnectivityStatus {
  return useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot
  );
}

/**
 * Hook to get the current offline queue of pending mutations
 *
 * @returns Array of queued mutations waiting to be replayed
 */
export function useOfflineQueue(): QueuedMutation[] {
  return useSyncExternalStore(
    offlineQueueStore.subscribe,
    offlineQueueStore.getSnapshot
  );
}

/**
 * Hook to get both connectivity status and queue info
 *
 * @returns { connectivity, isOnline, isOffline, isDegraded, pendingCount }
 */
export function useOfflineStatus() {
  const connectivity = useConnectivity();
  const queue = useOfflineQueue();

  return {
    connectivity,
    isOnline: connectivity === "online",
    isOffline: connectivity === "offline",
    isDegraded: connectivity === "degraded",
    pendingCount: queue.length,
    pendingMutations: queue
  };
}
