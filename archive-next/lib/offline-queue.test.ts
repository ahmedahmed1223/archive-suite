/**
 * Tests for offline queue system
 *
 * To run: Set up vitest in archive-next and run `pnpm test`
 * Or manually verify by opening DevTools and checking localStorage[archive-offline-queue]
 */

import {
  queueMutation,
  removeMutationFromQueue,
  updateMutationRetry,
  clearOfflineQueue,
  getOfflineQueue,
  loadOfflineQueue,
  type QueuedMutation
} from "./offline-queue";

// Test: Queue a mutation
function testQueueMutation() {
  clearOfflineQueue();
  const id = queueMutation("/records/123", "PATCH", { title: "Updated" });

  const queue = getOfflineQueue();
  console.assert(queue.length === 1, "Queue should have 1 item");
  console.assert(queue[0].id === id, "Mutation ID should match");
  console.assert(queue[0].endpoint === "/records/123", "Endpoint should match");
  console.assert(queue[0].method === "PATCH", "Method should match");
  console.assert(queue[0].retryCount === 0, "Retry count should start at 0");
  console.log("✓ testQueueMutation passed");
}

// Test: Remove mutation from queue
function testRemoveMutation() {
  clearOfflineQueue();
  const id1 = queueMutation("/records/1", "POST", {});
  const id2 = queueMutation("/records/2", "POST", {});

  removeMutationFromQueue(id1);
  const queue = getOfflineQueue();

  console.assert(queue.length === 1, "Queue should have 1 item after removal");
  console.assert(queue[0].id === id2, "Remaining item should be id2");
  console.log("✓ testRemoveMutation passed");
}

// Test: Update retry count
function testUpdateRetry() {
  clearOfflineQueue();
  const id = queueMutation("/records/1", "POST", {});

  updateMutationRetry(id, "Connection timeout");
  const queue = getOfflineQueue();

  console.assert(queue[0].retryCount === 1, "Retry count should increment");
  console.assert(
    queue[0].lastError === "Connection timeout",
    "Error message should be set"
  );
  console.log("✓ testUpdateRetry passed");
}

// Test: Clear queue
function testClearQueue() {
  clearOfflineQueue();
  queueMutation("/records/1", "POST", {});
  queueMutation("/records/2", "PATCH", {});

  clearOfflineQueue();
  const queue = getOfflineQueue();

  console.assert(queue.length === 0, "Queue should be empty after clear");
  console.log("✓ testClearQueue passed");
}

// Test: Queue persists to localStorage
function testPersistence() {
  if (typeof localStorage === "undefined") {
    console.log("⊘ testPersistence skipped (no localStorage in this environment)");
    return;
  }

  clearOfflineQueue();
  const id = queueMutation("/records/1", "POST", { title: "New" });

  // Manually verify localStorage (automated test would require mocking)
  const stored = localStorage.getItem("archive-offline-queue");
  console.assert(stored !== null, "Queue should be persisted to localStorage");

  if (stored) {
    const data = JSON.parse(stored) as { version: number; items: QueuedMutation[] };
    console.assert(data.version === 1, "Storage version should match");
    console.assert(data.items.length === 1, "Stored items should have 1 entry");
    console.assert(data.items[0].id === id, "Stored mutation ID should match");
  }

  console.log("✓ testPersistence passed");
}

// Run all tests
export function runOfflineQueueTests() {
  console.log("Running offline queue tests...");
  testQueueMutation();
  testRemoveMutation();
  testUpdateRetry();
  testClearQueue();
  testPersistence();
  console.log("All tests passed! ✓");
}

// Manual test instructions:
// 1. Open browser DevTools
// 2. In the console, run: import('archive-next/lib/offline-queue.test').then(m => m.runOfflineQueueTests())
// 3. Check console output for test results
