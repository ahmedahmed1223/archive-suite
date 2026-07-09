"use client";

import { getConnectivityStatus } from "./connectivity-probe";
import { queueMutation } from "./offline-queue";
import { toastError } from "./toast";
import type { ApiEnvelope } from "./archive-api";

/**
 * Wraps a mutating API call to queue it offline if needed.
 *
 * Usage:
 *   const result = await offlineSafeMutation(
 *     async () => apiClient.createRecord(payload),
 *     "/records",
 *     "POST",
 *     payload
 *   );
 */
export async function offlineSafeMutation<T extends object>(
  apiCall: () => Promise<ApiEnvelope<T>>,
  endpoint: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<ApiEnvelope<T>> {
  const status = getConnectivityStatus();

  // Try the API call if online
  if (status === "online") {
    try {
      const result = await apiCall();

      // If the call failed but we're supposedly online, might be a degraded connection
      if (!result.ok) {
        // Still return the error - don't queue on 4xx/5xx errors
        return result;
      }

      return result;
    } catch (error) {
      // Network error while supposedly online - might be degraded
      // Don't queue, let the error propagate to the UI
      return {
        ok: false,
        error: "خطأ في الاتصال. تحقق من الاتصال ثم أعد المحاولة."
      } as ApiEnvelope<T>;
    }
  }

  // Offline - queue the mutation
  const mutationId = queueMutation(endpoint, method, body);
  toastError(
    "أنت غير متصل. سيتم إرسال هذا التغيير تلقائياً عند استعادة الاتصال."
  );

  // Return an optimistic success to the UI
  // The actual mutation will be replayed when reconnected
  return {
    ok: true,
    // Return empty object to satisfy type T - actual data will come from server on replay
  } as unknown as ApiEnvelope<T>;
}

// ponytail: optimistic response strategy. Returns synthetic success for offline mutations. Server is source of truth on replay.
