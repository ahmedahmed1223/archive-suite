import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";

import {
  createRetentionScheduler,
  RETENTION_SWEEP_INTERVAL_MS,
  runRetentionSweep,
} from "../retentionScheduler.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-29T10:00:00.000Z");

const silentLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function oldItem(overrides = {}) {
  return {
    id: "item-1",
    store: "videos",
    documentType: "video",
    mimeType: "video/mp4",
    fileKey: null,
    tags: [],
    metadata: null,
    createdAt: new Date(NOW.getTime() - 120 * MS_DAY),
    archivedAt: null,
    isDeleted: false,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    id: "rule-1",
    name: "Delete old videos",
    scope: "type:video",
    lifetimeDays: 90,
    action: "delete",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makePrisma({ items = [], rules = [] } = {}) {
  return {
    retentionRule: {
      findMany: vi.fn().mockResolvedValue(rules),
    },
    archiveItem: {
      findMany: vi.fn().mockResolvedValue(items),
      updateMany: vi.fn().mockResolvedValue({ count: items.length }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runRetentionSweep", () => {
  it("archives expired items that match archive rules", async () => {
    const prisma = makePrisma({
      rules: [rule({ action: "archive" })],
      items: [oldItem({ id: "archive-me" })],
    });

    const result = await runRetentionSweep({ prisma, logger: silentLogger, now: NOW });

    expect(result).toMatchObject({ scanned: 1, rules: 1, archived: 1, deleted: 0 });
    expect(prisma.archiveItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["archive-me"] } },
      data: { archivedAt: NOW },
    });
    expect(prisma.archiveItem.update).not.toHaveBeenCalled();
  });

  it("secure-wipes disk files before soft-deleting expired items", async () => {
    const rootDir = path.join(process.cwd(), "var", "retention-test");
    const fileKey = "expired/video.mov";
    const expectedPath = path.resolve(rootDir, fileKey);
    const secureOverwrite = vi.fn().mockResolvedValue({
      filepath: expectedPath,
      passes: 3,
      fileSizeBytes: 1024,
    });
    const files = {
      describe: () => ({ kind: "disk", rootDir }),
      remove: vi.fn(),
    };
    const prisma = makePrisma({
      rules: [rule()],
      items: [oldItem({ id: "delete-me", fileKey })],
    });

    const result = await runRetentionSweep({ prisma, files, logger: silentLogger, secureOverwrite, now: NOW });

    expect(result).toMatchObject({ scanned: 1, rules: 1, deleted: 1, wiped: 1, removed: 0 });
    expect(secureOverwrite).toHaveBeenCalledWith(expectedPath);
    expect(files.remove).not.toHaveBeenCalled();
    expect(prisma.archiveItem.update).toHaveBeenCalledWith({
      where: { id: "delete-me" },
      data: { isDeleted: true, deletedAt: NOW },
    });
  });

  it("removes files through non-disk providers before soft delete", async () => {
    const files = {
      describe: () => ({ kind: "s3", bucket: "archive" }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const secureOverwrite = vi.fn();
    const prisma = makePrisma({
      rules: [rule()],
      items: [oldItem({ id: "cloud-delete", fileKey: "media/cloud.mov" })],
    });

    const result = await runRetentionSweep({ prisma, files, logger: silentLogger, secureOverwrite, now: NOW });

    expect(result).toMatchObject({ deleted: 1, wiped: 0, removed: 1 });
    expect(secureOverwrite).not.toHaveBeenCalled();
    expect(files.remove).toHaveBeenCalledWith("media/cloud.mov");
    expect(prisma.archiveItem.update).toHaveBeenCalledWith({
      where: { id: "cloud-delete" },
      data: { isDeleted: true, deletedAt: NOW },
    });
  });

  it("does not soft-delete when secure wipe explicitly skips a local file", async () => {
    const rootDir = path.join(process.cwd(), "var", "retention-test");
    const fileKey = "huge/master.mxf";
    const secureOverwrite = vi.fn().mockResolvedValue({
      filepath: path.resolve(rootDir, fileKey),
      passes: 0,
      fileSizeBytes: 12 * 1024 * 1024 * 1024,
      skipped: true,
      reason: "file-too-large",
    });
    const files = {
      describe: () => ({ kind: "disk", rootDir }),
      remove: vi.fn(),
    };
    const prisma = makePrisma({
      rules: [rule()],
      items: [oldItem({ id: "too-large", fileKey })],
    });

    const result = await runRetentionSweep({ prisma, files, logger: silentLogger, secureOverwrite, now: NOW });

    expect(result).toMatchObject({ deleted: 0, wiped: 0, skipped: 1 });
    expect(secureOverwrite).toHaveBeenCalledWith(path.resolve(rootDir, fileKey));
    expect(files.remove).not.toHaveBeenCalled();
    expect(prisma.archiveItem.update).not.toHaveBeenCalled();
  });

  it("skips cleanly when there are no active retention rules", async () => {
    const prisma = makePrisma({ rules: [], items: [oldItem()] });

    const result = await runRetentionSweep({ prisma, logger: silentLogger, now: NOW });

    expect(result).toMatchObject({ scanned: 0, rules: 0, archived: 0, deleted: 0 });
    expect(prisma.archiveItem.findMany).not.toHaveBeenCalled();
  });
});

describe("createRetentionScheduler", () => {
  it("starts a daily interval and stops it without leaving the scheduler active", async () => {
    vi.useFakeTimers();
    const prisma = makePrisma({ rules: [], items: [] });
    const scheduler = createRetentionScheduler({
      prisma,
      logger: silentLogger,
      intervalMs: RETENTION_SWEEP_INTERVAL_MS,
    });

    const stop = scheduler.start({ runImmediately: false });
    expect(scheduler.getStatus()).toMatchObject({ scheduled: true, running: false });

    await vi.advanceTimersByTimeAsync(RETENTION_SWEEP_INTERVAL_MS);
    expect(prisma.retentionRule.findMany).toHaveBeenCalledTimes(1);

    stop();
    expect(scheduler.getStatus()).toMatchObject({ scheduled: false, running: false });
  });
});
