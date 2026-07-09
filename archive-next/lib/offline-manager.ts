"use client";

import {
  getOfflineQueue,
  loadOfflineQueue,
  removeMutationFromQueue,
  updateMutationRetry,
  clearOfflineQueue,
  type QueuedMutation
} from "./offline-queue";
import {
  startConnectivityProbe,
  stopConnectivityProbe,
  subscribeToConnectivity,
  getConnectivityStatus,
  type ConnectivityStatus
} from "./connectivity-probe";
import { toast, toastError, toastSuccess } from "./toast";

const MAX_RETRIES = 3;

let isReplaying = false;
let replayAbortController: AbortController | null = null;

/**
 * Initialize the offline system:
 * - Load queue from storage
 * - Start connectivity probe
 * - Set up replay on reconnect
 */
export function initializeOfflineManager() {
  if (typeof window === "undefined") return;

  // Load persisted queue from localStorage
  loadOfflineQueue();

  // Start monitoring connectivity
  startConnectivityProbe();

  // Listen for connectivity changes and replay on reconnect
  subscribeToConnectivity((status) => {
    if (status === "online") {
      replayOfflineQueue();
    }
  });
}

/**
 * Shutdown offline manager
 */
export function shutdownOfflineManager() {
  stopConnectivityProbe();
  if (replayAbortController) {
    replayAbortController.abort();
  }
}

/**
 * Replay all queued mutations when connectivity is restored.
 * Implements last-write-wins strategy: newer mutations override older ones.
 */
export async function replayOfflineQueue() {
  if (isReplaying) return; // Prevent concurrent replays
  if (getConnectivityStatus() !== "online") return; // Don't replay if offline

  isReplaying = true;
  replayAbortController = new AbortController();

  try {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    toast(`الرجوع إلى الإنترنت. إعادة محاولة ${queue.length} عملية...`, "info");

    const results = {
      succeeded: 0,
      failed: 0,
      conflicts: new Map<string, string[]>() // endpoint -> [itemIds that conflict]
    };

    // Group by endpoint to detect conflicts (last-write-wins)
    const endpointMap = new Map<string, QueuedMutation[]>();
    for (const mutation of queue) {
      const mutations = endpointMap.get(mutation.endpoint) ?? [];
      mutations.push(mutation);
      endpointMap.set(mutation.endpoint, mutations);
    }

    // Replay mutations, skipping older ones for the same endpoint (last-write-wins)
    for (const [endpoint, mutations] of endpointMap.entries()) {
      const sortedByTime = [...mutations].sort((a, b) => a.createdAt - b.createdAt);
      const latestMutation = sortedByTime[sortedByTime.length - 1];
      const skipped = sortedByTime.slice(0, -1);

      if (skipped.length > 0) {
        results.conflicts.set(
          endpoint,
          skipped.map((m) => m.id)
        );
      }

      await replayMutation(latestMutation, results);
    }

    // Report results
    if (results.failed === 0) {
      if (results.succeeded > 0) {
        toastSuccess(
          `تم إعادة محاولة ${results.succeeded} عملية بنجاح. تم تطبيق البيانات.`
        );
      }
    } else {
      toastError(
        `أعيدت محاولة ${results.succeeded} عملية. فشل ${results.failed}. يرجى المحاولة يدويا.`
      );
    }

    // Clean up any mutations that were either succeeded or exceed retry limit
    for (const mutation of queue) {
      if (!results.conflicts.get(mutation.endpoint)?.includes(mutation.id)) {
        removeMutationFromQueue(mutation.id);
      }
    }
  } catch (error) {
    toastError("خطأ أثناء محاولة إعادة تطبيق البيانات. سيتم المحاولة لاحقا.");
  } finally {
    isReplaying = false;
    replayAbortController = null;
  }
}

/**
 * Replay a single mutation with retry logic
 */
async function replayMutation(
  mutation: QueuedMutation,
  results: { succeeded: number; failed: number }
) {
  if (mutation.retryCount >= MAX_RETRIES) {
    results.failed++;
    return;
  }

  try {
    const response = await fetch(`/api/v1${mutation.endpoint}`, {
      method: mutation.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      credentials: "include",
      body: mutation.body ? JSON.stringify(mutation.body) : undefined,
      signal: replayAbortController?.signal
    });

    if (response.ok) {
      results.succeeded++;
      removeMutationFromQueue(mutation.id);
    } else {
      const errorText = await response.text();
      updateMutationRetry(mutation.id, errorText);
      results.failed++;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    updateMutationRetry(mutation.id, errorMsg);
    results.failed++;
  }
}

/**
 * Get current offline queue for display
 */
export function getPendingMutations() {
  return getOfflineQueue();
}

/**
 * Clear the offline queue manually
 */
export function clearPendingMutations() {
  clearOfflineQueue();
}

// ponytail: replay uses last-write-wins (naive LWW). Could upgrade to vector clocks or CRDTs if conflicts become frequent.
