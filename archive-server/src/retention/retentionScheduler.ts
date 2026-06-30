import path from "node:path";

import { scanRetention } from "./retentionPolicy.js";
import { secureOverwrite as defaultSecureOverwrite } from "./secureDelete.js";

export const RETENTION_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

type RetentionAction = "archive" | "delete";
type RemovedFileMode = "secure-wipe" | "secure-skip" | "provider-remove" | "metadata-only";

interface LoggerLike {
  info?: (payload?: unknown, message?: string) => void;
  warn?: (payload?: unknown, message?: string) => void;
  error?: (payload?: unknown, message?: string) => void;
  debug?: (payload?: unknown, message?: string) => void;
}

function bindLogger(logger: LoggerLike | null | undefined): Required<LoggerLike> {
  if (!logger) return noopLogger;
  return {
    info: (...args) => (logger.info || noopLogger.info)?.call(logger, ...args),
    warn: (...args) => (logger.warn || noopLogger.warn)?.call(logger, ...args),
    error: (...args) => (logger.error || noopLogger.error)?.call(logger, ...args),
    debug: (...args) => (logger.debug || noopLogger.debug)?.call(logger, ...args),
  };
}

interface ArchiveItemLike {
  id: string;
  store?: string;
  documentType?: string | null;
  mimeType?: string | null;
  fileKey?: string | null;
  filePath?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string | number | null;
  created_at?: Date | string | number | null;
  archivedAt?: Date | string | number | null;
  isDeleted?: boolean;
}

interface RetentionRuleLike {
  id?: string;
  name?: string;
  scope: string;
  lifetimeDays: number;
  action: RetentionAction;
  active?: boolean;
  createdAt?: Date | string | number | null;
}

interface FileStoreLike {
  describe?: () => { kind?: string; rootDir?: string; [key: string]: unknown };
  remove?: (key: string) => Promise<void>;
}

interface PrismaLike {
  retentionRule?: {
    findMany: (args: unknown) => Promise<RetentionRuleLike[]>;
  };
  archiveItem?: {
    findMany: (args: unknown) => Promise<ArchiveItemLike[]>;
    updateMany: (args: unknown) => Promise<{ count?: number }>;
    update: (args: unknown) => Promise<unknown>;
  };
}

interface SecureOverwriteResult {
  filepath?: string;
  passes?: number;
  fileSizeBytes?: number;
  skipped?: boolean;
  reason?: string;
}

type SecureOverwriteFn = (filepath: string) => Promise<SecureOverwriteResult>;

interface RetentionSweepResult {
  scanned: number;
  rules: number;
  archived: number;
  deleted: number;
  wiped: number;
  removed: number;
  skipped: number;
  errors: number;
}

interface RetentionSweepOptions {
  prisma?: PrismaLike | null;
  files?: FileStoreLike | null;
  logger?: LoggerLike;
  secureOverwrite?: SecureOverwriteFn;
  now?: Date;
}

interface RetentionSchedulerOptions extends RetentionSweepOptions {
  intervalMs?: number;
}

interface RetentionSchedulerStatus {
  scheduled: boolean;
  running: boolean;
  intervalMs: number;
  intervalHours: number;
  startedAt: string | null;
  lastRunAt: string | null;
}

interface RetentionScheduler {
  runOnce: () => Promise<RetentionSweepResult | null>;
  start: (options?: { runImmediately?: boolean }) => () => void;
  stop: () => void;
  getStatus: () => RetentionSchedulerStatus;
}

interface RemovedFileResult extends SecureOverwriteResult {
  mode: RemovedFileMode;
  fileKey?: string;
}

const noopLogger: Required<LoggerLike> = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

/** Execute one retention sweep against typed archive items. */
export async function runRetentionSweep({
  prisma,
  files = null,
  logger = noopLogger,
  secureOverwrite = defaultSecureOverwrite,
  now = new Date(),
}: RetentionSweepOptions = {}): Promise<RetentionSweepResult> {
  const log = bindLogger(logger);
  const empty: RetentionSweepResult = { scanned: 0, rules: 0, archived: 0, deleted: 0, wiped: 0, removed: 0, skipped: 0, errors: 0 };

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

  const { toArchive, toDelete } = scanRetention(items as any, activeRules, now.getTime()) as {
    toArchive: ArchiveItemLike[];
    toDelete: ArchiveItemLike[];
  };

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

      if (!item.id) {
        skipped += 1;
        continue;
      }

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

  const result: RetentionSweepResult = {
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

/** Create a daily retention scheduler. The scheduler is inert until start(). */
export function createRetentionScheduler({
  prisma,
  files = null,
  logger = noopLogger,
  intervalMs = RETENTION_SWEEP_INTERVAL_MS,
  secureOverwrite = defaultSecureOverwrite,
}: RetentionSchedulerOptions = {}): RetentionScheduler {
  const log = bindLogger(logger);
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let startedAt: Date | null = null;
  let lastRunAt: Date | null = null;

  async function runOnce(): Promise<RetentionSweepResult | null> {
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

  function start({ runImmediately = true }: { runImmediately?: boolean } = {}): () => void {
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

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    running = false;
  }

  function getStatus(): RetentionSchedulerStatus {
    return {
      scheduled: Boolean(timer),
      running,
      intervalMs,
      intervalHours: intervalMs / 3_600_000,
      startedAt: startedAt?.toISOString() || null,
      lastRunAt: lastRunAt?.toISOString() || null,
    };
  }

  return { runOnce, start, stop, getStatus };
}

async function removeRetainedFile({
  item,
  files,
  secureOverwrite,
  logger,
}: {
  item: ArchiveItemLike;
  files: FileStoreLike | null;
  secureOverwrite: SecureOverwriteFn;
  logger: Required<LoggerLike>;
}): Promise<RemovedFileResult> {
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

function resolveFileKey(item: ArchiveItemLike): string {
  const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
  const fileKey = item?.fileKey ?? metadata.fileKey ?? metadata.storageKey;
  return typeof fileKey === "string" && fileKey.trim() ? fileKey.trim() : "";
}

function resolveMetadataFilePath(item: ArchiveItemLike): string {
  const metadata = isPlainObject(item?.metadata) ? item.metadata : {};
  const filePath = item?.filePath ?? metadata.filePath ?? metadata.localPath;
  return typeof filePath === "string" && filePath.trim() ? filePath.trim() : "";
}

function resolveDiskFilePath(files: FileStoreLike | null, fileKey: string): string {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
