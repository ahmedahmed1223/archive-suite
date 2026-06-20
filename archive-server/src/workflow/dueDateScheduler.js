/**
 * dueDateScheduler.js — §20.3 workflow due-date reminder push notifications.
 *
 * Runs on a configurable interval (default: hourly) and sends push alerts to
 * record owners for:
 *   - "upcoming": dueDate is within the next 24 h (and not yet overdue)
 *   - "overdue":  dueDate has already passed
 *
 * Each (store, id, alertType) pair is tracked per calendar-day so the same
 * alert fires at most once per day regardless of how often the scheduler ticks.
 *
 * Stores queried: video_items, media_items, document_items, audio_items, image_items
 * Terminal statuses that suppress alerts: published, archived
 */

import { createLogger } from "../logger.js";

const log = createLogger("workflow:due-date");

const CONTENT_STORES = ["video_items", "media_items", "document_items", "audio_items", "image_items"];
const TERMINAL_STATES = new Set(["published", "archived"]);
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Check interval — configurable via WORKFLOW_DUE_CHECK_HOURS env, default 1 hour.
const CHECK_INTERVAL_MS = parseInt(process.env.WORKFLOW_DUE_CHECK_HOURS || "1", 10) * 3_600_000;

// In-memory dedup: keys are "<store>:<id>:<alertType>:<YYYY-MM-DD>".
// Prevents spamming the same alert multiple times in the same calendar day.
const sentToday = new Map();

let schedulerTimer = null;

/** Return ISO date string "YYYY-MM-DD" for dedup bucketing. */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Single-run pass: find records with upcoming or overdue workflowDueDate
 * and dispatch push notifications to their owners.
 *
 * @param {object} provider - storage provider with .getAll(store)
 * @param {object} prisma   - Prisma client (for push subscriptions)
 * @param {Function} sendPushToUser - injectable for tests
 */
export async function runDueDateCheck(provider, prisma, sendPushToUser) {
  if (!provider || !prisma) return;

  const now = Date.now();
  const day = todayKey();
  let upcoming = 0;
  let overdue = 0;

  for (const store of CONTENT_STORES) {
    let records;
    try {
      records = await provider.getAll(store);
    } catch {
      continue; // store might not exist in this deployment
    }
    if (!Array.isArray(records)) continue;

    for (const record of records) {
      const dueDate = record?.workflowDueDate;
      if (!dueDate) continue;

      const status = record?.workflowStatus;
      if (TERMINAL_STATES.has(status)) continue;

      const dueMs = Date.parse(dueDate);
      if (Number.isNaN(dueMs)) continue;

      // Determine owner: prefer createdBy (set at creation), fall back to ownerId.
      const ownerId = record?.createdBy || record?.ownerId;
      if (!ownerId) continue;

      const id = String(record?.id || "");
      if (!id) continue;

      const title = record?.title || id;

      if (dueMs < now) {
        // Overdue
        const dedupKey = `${store}:${id}:overdue:${day}`;
        if (!sentToday.has(dedupKey)) {
          sentToday.set(dedupKey, true);
          sendPushToUser({
            prisma,
            userId: ownerId,
            type: "system",
            title: `سجل متأخر — ${title}`,
            body: `تجاوز السجل تاريخ استحقاقه (${dueDate.slice(0, 10)}).`,
            tag: `workflow-overdue:${id}`,
          });
          overdue++;
        }
      } else if (dueMs - now <= UPCOMING_WINDOW_MS) {
        // Due within 24 hours
        const dedupKey = `${store}:${id}:upcoming:${day}`;
        if (!sentToday.has(dedupKey)) {
          sentToday.set(dedupKey, true);
          const hoursLeft = Math.round((dueMs - now) / 3_600_000);
          sendPushToUser({
            prisma,
            userId: ownerId,
            type: "system",
            title: `موعد استحقاق قريب — ${title}`,
            body: `يستحق السجل خلال ${hoursLeft} ساعة (${dueDate.slice(0, 10)}).`,
            tag: `workflow-upcoming:${id}`,
          });
          upcoming++;
        }
      }
    }
  }

  if (upcoming + overdue > 0) {
    log.info({ upcoming, overdue }, "Due-date check: notifications dispatched.");
  } else {
    log.debug("Due-date check: no pending reminders.");
  }
}

/**
 * Start the recurring due-date check scheduler.
 *
 * @param {object}   provider       - storage provider
 * @param {object}   prisma         - Prisma client
 * @param {Function} sendPushFn     - sendPushToUser (injectable for tests)
 */
export function startDueDateScheduler(provider, prisma, sendPushFn) {
  if (!process.env.WORKFLOW_DUE_REMINDERS_ENABLED) {
    log.debug("Workflow due-date reminders disabled (set WORKFLOW_DUE_REMINDERS_ENABLED=true).");
    return;
  }

  log.info({ intervalHours: CHECK_INTERVAL_MS / 3_600_000 }, "Workflow due-date scheduler started.");

  // Run immediately on startup, then on interval.
  runDueDateCheck(provider, prisma, sendPushFn).catch((err) =>
    log.warn({ err: err?.message }, "Due-date check failed on startup.")
  );

  schedulerTimer = setInterval(() => {
    runDueDateCheck(provider, prisma, sendPushFn).catch((err) =>
      log.warn({ err: err?.message }, "Due-date check failed.")
    );
  }, CHECK_INTERVAL_MS);
  schedulerTimer?.unref?.();
}

export function stopDueDateScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  sentToday.clear();
}

/** Reset the dedup map — use in tests to isolate runs. */
export function clearSentToday() {
  sentToday.clear();
}
