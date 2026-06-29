/**
 * dueDateScheduler.ts — §20.3 workflow due-date reminder push notifications.
 *
 * Runs on a configurable interval (default: hourly) and sends push alerts to
 * record owners for:
 *   - "upcoming": dueDate is within the next 24 h (and not yet overdue)
 *   - "overdue":  dueDate has already passed
 */

import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("workflow:due-date");

const CONTENT_STORES = ["video_items", "media_items", "document_items", "audio_items", "image_items"];
const TERMINAL_STATES = new Set(["published", "archived"]);
const UPCOMING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Check interval — configurable via WORKFLOW_DUE_CHECK_HOURS env, default 1 hour.
const CHECK_INTERVAL_MS = (config.workflowDueCheckHours ?? 1) * 3_600_000;

// In-memory dedup: keys are "<store>:<id>:<alertType>:<YYYY-MM-DD>".
// Prevents spamming the same alert multiple times in the same calendar day.
const sentToday = new Map<string, boolean>();

let schedulerTimer: NodeJS.Timeout | null = null;

interface WorkflowRecord {
  id: string;
  title?: string;
  workflowStatus?: string;
  workflowDueDate?: string;
  createdBy?: string;
  ownerId?: string;
}

interface StorageProvider {
  getAll: (store: string) => Promise<WorkflowRecord[]>;
}

/** Return ISO date string "YYYY-MM-DD" for dedup bucketing. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Single-run pass: find records with upcoming or overdue workflowDueDate
 * and dispatch push notifications to their owners.
 */
export async function runDueDateCheck(provider: StorageProvider | null, prisma: any, sendPushToUser: (opts: any) => void): Promise<void> {
  if (!provider || !prisma) return;

  const now = Date.now();
  const day = todayKey();
  let upcoming = 0;
  let overdue = 0;

  for (const store of CONTENT_STORES) {
    let records: WorkflowRecord[];
    try {
      records = await provider.getAll(store);
    } catch {
      continue; // store might not exist in this deployment
    }
    if (!Array.isArray(records)) continue;

    for (const record of records) {
      const dueDate = record?.workflowDueDate;
      if (!dueDate) continue;

      const status = record?.workflowStatus ?? "";
      if (TERMINAL_STATES.has(status)) continue;

      const dueMs = Date.parse(dueDate);
      if (Number.isNaN(dueMs)) continue;

      // Determine owner: prefer createdBy (set at creation), fall back to ownerId.
      const ownerId = record?.createdBy || record?.ownerId;
      if (!ownerId || typeof ownerId !== "string") continue;

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
 */
export function startDueDateScheduler(provider: StorageProvider | null, prisma: any, sendPushFn: (opts: any) => void): void {
  if (!config.workflowDueRemindersEnabled) {
    log.debug("Workflow due-date reminders disabled (set WORKFLOW_DUE_REMINDERS_ENABLED=true).");
    return;
  }

  log.info({ intervalHours: CHECK_INTERVAL_MS / 3_600_000 }, "Workflow due-date scheduler started.");

  // Run immediately on startup, then on interval.
  runDueDateCheck(provider, prisma, sendPushFn).catch((err) =>
    log.warn({ err: (err as any)?.message }, "Due-date check failed on startup.")
  );

  schedulerTimer = setInterval(() => {
    runDueDateCheck(provider, prisma, sendPushFn).catch((err) =>
      log.warn({ err: (err as any)?.message }, "Due-date check failed.")
    );
  }, CHECK_INTERVAL_MS);
  (schedulerTimer as any)?.unref?.();
}

export function stopDueDateScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  sentToday.clear();
}

/** Reset the dedup map — use in tests to isolate runs. */
export function clearSentToday(): void {
  sentToday.clear();
}
