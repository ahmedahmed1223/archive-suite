// @ts-nocheck
/**
 * Coordinator for applying an incoming transfer package against
 * local state without losing user changes. Pure-ish — it doesn't
 * touch the store directly; callers (the slice) feed it state in
 * and apply the resolved entities themselves.
 *
 * Workflow:
 *   1. detectConflicts splits incoming items into newItems,
 *      updates, conflicts, deletes.
 *   2. classifyPlan returns { autoApply, needsReview } where
 *      autoApply contains everything that can land without user
 *      confirmation (new + clean updates), and needsReview holds
 *      the conflicts + delete-vs-edit cases.
 *   3. After the user resolves the conflict UI, mergeResolved
 *      folds { itemId: resolvedEntity } back into the full list
 *      and returns the new videoItems array.
 */

import { detectConflicts } from "./conflictDetection.js";

export function planIncomingDelta({ localItems = [], incomingItems = [], baseSyncFloor = {} } = {}) {
  const plan = detectConflicts({ localItems, incomingItems, baseSyncFloor });
  return {
    plan,
    autoApply: {
      newItems: plan.newItems.map((entry) => entry.incoming),
      updates: plan.updates.map((entry) => entry.incoming)
    },
    needsReview: [...plan.conflicts, ...plan.deletes],
    summary: {
      newCount: plan.newItems.length,
      updateCount: plan.updates.length,
      conflictCount: plan.conflicts.length,
      deleteCount: plan.deletes.length,
      needsReview: plan.conflicts.length + plan.deletes.length > 0
    }
  };
}

/**
 * Merge auto-apply rows + user-resolved entities into the existing
 * videoItems list. Returns the new array; caller persists it.
 */
export function mergeIntoLocal({ localItems = [], autoApply = { newItems: [], updates: [] }, resolved = {} } = {}) {
  const localById = new Map();
  for (const item of localItems) {
    if (item?.id) localById.set(item.id, item);
  }

  // Auto-applied clean updates overwrite local copies.
  for (const update of autoApply.updates || []) {
    if (update?.id) localById.set(update.id, update);
  }
  // New items are appended.
  for (const fresh of autoApply.newItems || []) {
    if (fresh?.id) localById.set(fresh.id, fresh);
  }
  // User-resolved entities take precedence over everything.
  for (const [id, entity] of Object.entries(resolved)) {
    if (entity?.id) localById.set(id, entity);
  }

  return Array.from(localById.values());
}

