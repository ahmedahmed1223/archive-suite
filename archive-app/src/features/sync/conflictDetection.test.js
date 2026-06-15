import { describe, expect, test } from "vitest";
import {
  detectConflict,
  classifyConflicts,
  resolveConflict,
  CONFLICT_RESOLUTION_STRATEGIES
} from "./conflictDetection.js";

const rec = (overrides = {}) => ({
  id: "v1",
  title: "اجتماع",
  tags: ["عمل"],
  isDeleted: false,
  syncVersion: 1,
  updatedAt: "2026-06-15T10:00:00.000Z",
  lastModifiedBy: { deviceId: "device-a", at: "2026-06-15T10:00:00.000Z" },
  ...overrides
});

describe("detectConflict", () => {
  test("returns null when versions and timestamps match (in sync)", () => {
    expect(detectConflict(rec(), rec())).toBeNull();
  });

  test("returns null when one side is missing", () => {
    expect(detectConflict(null, rec())).toBeNull();
    expect(detectConflict(rec(), null)).toBeNull();
  });

  test("treats same-device higher version as fast-forward, not a conflict", () => {
    const local = rec({ syncVersion: 1 });
    const remote = rec({
      syncVersion: 2,
      title: "اجتماع محدّث",
      updatedAt: "2026-06-15T11:00:00.000Z",
      lastModifiedBy: { deviceId: "device-a", at: "2026-06-15T11:00:00.000Z" }
    });
    expect(detectConflict(local, remote)).toBeNull();
  });

  test("flags both-modified when versions and devices diverge", () => {
    const local = rec({ syncVersion: 2, title: "محلي" });
    const remote = rec({
      syncVersion: 3,
      title: "وارد",
      lastModifiedBy: { deviceId: "device-b", at: "2026-06-15T12:00:00.000Z" }
    });
    const conflict = detectConflict(local, remote);
    expect(conflict).not.toBeNull();
    expect(conflict.type).toBe("both-modified");
    expect(conflict.localVersion).toBe(2);
    expect(conflict.remoteVersion).toBe(3);
    expect(conflict.fields).toContain("title");
  });

  test("flags version-clash when versions equal but content differs", () => {
    const local = rec({ title: "محلي" });
    const remote = rec({ title: "وارد", updatedAt: "2026-06-15T10:30:00.000Z" });
    const conflict = detectConflict(local, remote);
    expect(conflict.type).toBe("version-clash");
    expect(conflict.fields).toContain("title");
  });

  test("flags delete-vs-edit when remote deleted and local edited", () => {
    const local = rec({ syncVersion: 2, title: "تعديل محلي" });
    const remote = rec({
      syncVersion: 3,
      isDeleted: true,
      lastModifiedBy: { deviceId: "device-b", at: "2026-06-15T12:00:00.000Z" }
    });
    expect(detectConflict(local, remote).type).toBe("delete-vs-edit");
  });

  test("flags edit-vs-delete when local deleted and remote edited", () => {
    const local = rec({ syncVersion: 2, isDeleted: true });
    const remote = rec({
      syncVersion: 3,
      title: "تعديل وارد",
      lastModifiedBy: { deviceId: "device-b", at: "2026-06-15T12:00:00.000Z" }
    });
    expect(detectConflict(local, remote).type).toBe("edit-vs-delete");
  });

  test("treats missing metadata as version 0 / no device chain", () => {
    const local = { id: "v1", title: "محلي" };
    const remote = { id: "v1", title: "وارد", syncVersion: 1, lastModifiedBy: { deviceId: "device-b" } };
    const conflict = detectConflict(local, remote);
    expect(conflict).not.toBeNull();
    expect(conflict.localVersion).toBe(0);
    expect(conflict.remoteVersion).toBe(1);
  });
});

describe("classifyConflicts", () => {
  test("buckets ids into conflicts / localOnly / remoteOnly / inSync", () => {
    const localOnlyRec = rec({ id: "only-local" });
    const remoteOnlyRec = rec({ id: "only-remote" });
    const syncedLocal = rec({ id: "synced" });
    const syncedRemote = rec({ id: "synced" });
    const conflictLocal = rec({ id: "clash", syncVersion: 2, title: "محلي" });
    const conflictRemote = rec({
      id: "clash",
      syncVersion: 3,
      title: "وارد",
      lastModifiedBy: { deviceId: "device-b", at: "2026-06-15T12:00:00.000Z" }
    });

    const result = classifyConflicts(
      [localOnlyRec, syncedLocal, conflictLocal],
      [remoteOnlyRec, syncedRemote, conflictRemote]
    );

    expect(result.localOnly.map((r) => r.id)).toEqual(["only-local"]);
    expect(result.remoteOnly.map((r) => r.id)).toEqual(["only-remote"]);
    expect(result.inSync.map((r) => r.id)).toEqual(["synced"]);
    expect(result.conflicts.map((r) => r.id)).toEqual(["clash"]);
    expect(result.conflicts[0].type).toBe("both-modified");
  });

  test("handles empty inputs", () => {
    const result = classifyConflicts();
    expect(result).toEqual({ conflicts: [], localOnly: [], remoteOnly: [], inSync: [] });
  });
});

describe("resolveConflict", () => {
  const conflict = {
    local: rec({ syncVersion: 2, title: "محلي", updatedAt: "2026-06-15T10:00:00.000Z" }),
    remote: rec({ syncVersion: 3, title: "وارد", updatedAt: "2026-06-15T12:00:00.000Z" })
  };

  test("keepLocal returns an immutable copy of local", () => {
    const resolved = resolveConflict(conflict, "keepLocal");
    expect(resolved.title).toBe("محلي");
    expect(resolved).not.toBe(conflict.local);
  });

  test("keepRemote returns an immutable copy of remote", () => {
    const resolved = resolveConflict(conflict, "keepRemote");
    expect(resolved.title).toBe("وارد");
    expect(resolved).not.toBe(conflict.remote);
  });

  test("newest picks the record with the later updatedAt", () => {
    expect(resolveConflict(conflict, "newest").title).toBe("وارد");
  });

  test("newest falls back to higher syncVersion when timestamps tie", () => {
    const tie = {
      local: rec({ syncVersion: 5, title: "محلي", updatedAt: "2026-06-15T10:00:00.000Z" }),
      remote: rec({ syncVersion: 2, title: "وارد", updatedAt: "2026-06-15T10:00:00.000Z" })
    };
    expect(resolveConflict(tie, "newest").title).toBe("محلي");
  });

  test("throws on unsupported strategy", () => {
    expect(() => resolveConflict(conflict, "coinflip")).toThrow();
  });

  test("throws on invalid conflict", () => {
    expect(() => resolveConflict(null, "keepLocal")).toThrow();
  });

  test("exposes the supported strategy list", () => {
    expect(CONFLICT_RESOLUTION_STRATEGIES).toEqual(["keepLocal", "keepRemote", "newest"]);
  });
});
