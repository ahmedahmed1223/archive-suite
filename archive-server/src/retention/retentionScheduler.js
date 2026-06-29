import path from "node:path";

import { scanRetention } from "./retentionPolicy.js";
import { secureOverwrite as defaultSecureOverwrite } from "./secureDelete.js";

export const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/**
 * Execute one retention sweep against typed archive items.
 *
 * @param {object} params
 * @param {import("../generated/prisma/client.js").PrismaClient} params.prisma
 * @param {object} [params.files]
 * @param {{ info?: Function, warn?: Function, error?: Function, debug?: Function }} [params.logger]
 * @param {Function} [params.secureOverwrite]
 * @param {Date} [params.now]
 * @returns {Promise<{ scanned: number, rules: number, archived: number, deleted: number, wiped: number, removed: number, skipped: number, errors: number }>}
 */
export async function runRetentionSweep({
  prisma,
  files = null,
  logger = noopLogger,
  secureOverwrite = defaultSecureOverwrite,
  now = new Date(),
} = {}) {
  const log = { ...noopLogger, ...(logger || {}) };
  const empty = { scanned: 0, rules: 0, archived: 0, deleted: 0, wiped: 0, removed: 0, skipped: 0, errors: 0 };

  if (!prisma?.archiveItem || !prisma?.retentionRule) {
    log.debug?.("Retention sweep skipped: Prisma archiveItem/retentionRule models unavailable.");
    return empty;
  }

  const activeRules = await prisma.retentionRule.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  if (!activeRules.length) {
    log.debug?.("Retention sweep skipped: no active retention rules.");
    return { ...empty, rules: 0 };
  }

  const items = await prisma.archiveItem.findMany({
    where: { isDeleted: false, archivedAt: null },
    select: {
      id: true,
      store: true,
      documentType: true,
      mimeType: true,
      fileKey: true,
      tags: true,
      metadata: true,
      createdAt: true,
      archivedAt: true,
      isDeleted: true,
    },
  });

  const { toArchive, toDelete } = scanRetention(items, activeRules, now.getTime());

  let archived = 0;
  if (toArchive.length) {
    const result = await prisma.archiveItem.updateMany({
      where: { id: { in: toArchive.map((item) => item.id).filter(Boolean) } },
      data: { archivedAt: now },
    });
    archived = Number(result?.count || 0);
  }

  let deleted = 0;
  let wiped = 0;
  let removed = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of toDelete) {
    try {
      const fileResult = await removeRetainedFile({ item, files, secureOverwrite, logger: log });
      if (fileResult.mode === "secure-wipe") wiped += 1;
      if (fileResult.mode === "provider-remove") removed += 1;
      if (fileResult.mode === "metadata-only" || fileResult.mode === "secure-skip") skipped += 1;
      if (fileResult.mode === "secure-skip") continue;

      await prisma.archiveItem.update({
        where: { id: item.id },
        data: { isDeleted: true, deletedAt: now },
      });
      deleted += 1;
    } catch (err) {
      errors += 1;
      log.error?.({ err, itemId: item?.id }, "Retention sweep: failed to delete expired item.");
    }
  }

  const result = {
    scanned: items.length,
    rules: activeRules.length,
    archived,
    deleted,
    wiped,
    removed,
    skipped,
    errors,
  };

  if (archived || deleted || errors) {
    log.info?.(result, "Retention sweep completed.");
  } else {
    log.debug?.(result, "Retention sweep completed with no expired items.");
  }

  return result;
}

/**
 * Create a daily retention scheduler. The scheduler is inert until start().
 *
 * @param {object} params
 * @param {import("../generated/prisma/client.js").PrismaClient} params.prisma
 * @param {object} [params.files]
 * @param {{ info?: Function, warn?: Function, error?: Function, debug?: Function }} [params.logger]
 * @param {number} [params.intervalMs]
 * @param {Function} [params.secureOverwrite]
 */
export function createRetentionScheduler({
  prisma,
  files = null,
  logger = noopLogger,
  intervalMs = RETENTION_SWEEP_INTERVAL_MS,
  secureOverwrite = defaultSecureOverwrite,
} = {}) {
  const log = { ...noopLogger, ...(logger || {}) };
  let timer = null;
  let running = false;
  let startedAt = null;
  let lastRunAt = null;

  async function runOnce() {
    if (running) {
      log.debug?.("Retention sweep skipped: previous run still active.");
      return null;
    }
    running = true;
    lastRunAt = new Date();
    try {
      return await runRetentionSweep({ prisma, files, logger: log, secureOverwrite, now: lastRunAt });
    } catch (err) {
      log.error?.({ err }, "Retention sweep failed.");
      return null;
    } finally {
      running = false;
    }
  }

  function start({ runImmediately = true } = {}) {
    if (timer) return stop;

    startedAt = new Date();
    log.info?.({ intervalHours: intervalMs / 3_600_000 }, "Retention scheduler started.");

    if (runImmediately) {
      runOnce().catch((err) => log.warn?.({ err }, "Retention sweep failed on startup."));
    }

    timer = setInterval(() => {
      runOnce().catch((err) => log.warn?.({ err }, "Retention sweep failed."));
    }, intervalMs);
    timer?.unref?.();

    return stop;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    running = false;
  }

  function getStatus() {
    return {
      scheduled: Boolean(timer),
      running,
      intervalMs,
      intervalHours: intervalMs / 3_600_000,
      startedAt: startedAt?.toISOString?.() || null,
      lastRunAt: lastRunAt?.toISOString?.() || null,
    };
  }

  return { runOnce, start, stop, getStatus };
}

async function removeRetainedFile({ item, files, secureOverwrite, logger }) {
  const fileKey = resolveFileKey(item);
  const localPath = resolveDiskFilePath(files, fileKey) || resolveMetadataFilePath(item);

  if (localPath) {
    try {
      const result = await secureOverwrite(localPath);
      return { mode: result?.skipped ? "secure-skip" : "secure-wipe", ...result };
    } catch (err) {
      logger.warn?.({ err, itemId: item?.id, fileKey }, "Retention sweep: secure overwrite failed.");
      if (!fileKey || typeof files?.remove !== "function") throw err;
    }
  }

  if (fileKey && typeof files?.remove === "function") {
    await files.remove(fileKey);
    return { mode: "provider-remove", fileKey };
  }

  return { mode: "metadata-only", skipped: true };
}

function resolveFileKey(item) {
  const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
  const fileKey = item?.fileKey ?? metadata.fileKey ?? metadata.storageKey;
  return typeof fileKey === "string" && fileKey.trim() ? fileKey.trim() : "";
}

function resolveMetadataFilePath(item) {
  const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
  const filePath = item?.filePath ?? metadata.filePath ?? metadata.localPath;
  return typeof filePath === "string" && filePath.trim() ? filePath.trim() : "";
}

function resolveDiskFilePath(files, fileKey) {
  if (!fileKey || typeof files?.describe !== "function") return "";

  const info = files.describe();
  if (info?.kind !== "disk" || !info.rootDir) return "";

  const clean = String(fileKey || "").replace(/^\/+/, "");
  if (!clean || clean.includes("\0")) {
    throw new Error("Retention sweep: invalid file key.");
  }

  const root = path.resolve(info.rootDir);
  const target = path.resolve(root, clean);
  if (target !== root && target.startsWith(root + path.sep)) return target;

  throw new Error("Retention sweep: file key escapes disk root.");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
