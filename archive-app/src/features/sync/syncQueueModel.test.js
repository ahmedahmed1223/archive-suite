import { describe, expect, test } from "vitest";
import {
  createSyncOp,
  canTransition,
  transitionOp,
  summarizeQueue,
  nextPendingOp,
  SYNC_OP_STATUSES,
  SYNC_OP_ACTIONS
} from "./syncQueueModel.js";

describe("createSyncOp", () => {
  test("normalizes a valid op and defaults status to pending", () => {
    const op = createSyncOp({ entity: "videoItem", entityId: "v1", action: "update" });
    expect(op.id).toBeTruthy();
    expect(op.entity).toBe("videoItem");
    expect(op.entityId).toBe("v1");
    expect(op.action).toBe("update");
    expect(op.status).toBe("pending");
    expect(op.attempts).toBe(0);
    expect(op.error).toBeNull();
  });

  test("falls back to safe defaults for invalid action/status", () => {
    const op = createSyncOp({ action: "frobnicate", status: "weird" });
    expect(SYNC_OP_ACTIONS).toContain(op.action);
    expect(SYNC_OP_STATUSES).toContain(op.status);
    expect(op.action).toBe("update");
    expect(op.status).toBe("pending");
  });
});

describe("canTransition / transitionOp", () => {
  test("allows pending → inFlight and increments attempts", () => {
    expect(canTransition("pending", "inFlight")).toBe(true);
    const op = createSyncOp({ entityId: "v1", action: "create" });
    const next = transitionOp(op, "inFlight");
    expect(next.status).toBe("inFlight");
    expect(next.attempts).toBe(1);
    expect(next).not.toBe(op);
    expect(op.status).toBe("pending"); // input untouched
  });

  test("records error on transition to failed", () => {
    const op = transitionOp(createSyncOp({ entityId: "v1" }), "inFlight");
    const failed = transitionOp(op, "failed", { error: "تعذر الاتصال" });
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("تعذر الاتصال");
  });

  test("allows retry failed → pending", () => {
    expect(canTransition("failed", "pending")).toBe(true);
  });

  test("done is terminal", () => {
    expect(canTransition("done", "pending")).toBe(false);
    const op = transitionOp(transitionOp(createSyncOp({ entityId: "v1" }), "inFlight"), "done");
    expect(() => transitionOp(op, "pending")).toThrow();
  });

  test("throws on illegal transition and unknown status", () => {
    const op = createSyncOp({ entityId: "v1" });
    expect(() => transitionOp(op, "done")).toThrow();
    expect(() => transitionOp(op, "nonsense")).toThrow();
  });
});

describe("summarizeQueue", () => {
  test("counts ops per status", () => {
    const ops = [
      createSyncOp({ entityId: "a", status: "pending" }),
      createSyncOp({ entityId: "b", status: "pending" }),
      { ...createSyncOp({ entityId: "c" }), status: "inFlight" },
      { ...createSyncOp({ entityId: "d" }), status: "failed" },
      { ...createSyncOp({ entityId: "e" }), status: "done" }
    ];
    expect(summarizeQueue(ops)).toEqual({ pending: 2, inFlight: 1, failed: 1, done: 1 });
  });

  test("returns zeroed summary for non-array input", () => {
    expect(summarizeQueue(null)).toEqual({ pending: 0, inFlight: 0, failed: 0, done: 0 });
  });
});

describe("nextPendingOp", () => {
  test("returns the oldest pending op by createdAt", () => {
    const older = { ...createSyncOp({ entityId: "old" }), createdAt: "2026-06-15T09:00:00.000Z" };
    const newer = { ...createSyncOp({ entityId: "new" }), createdAt: "2026-06-15T10:00:00.000Z" };
    expect(nextPendingOp([newer, older]).entityId).toBe("old");
  });

  test("ignores non-pending ops and returns null when none pending", () => {
    const ops = [{ ...createSyncOp({ entityId: "x" }), status: "done" }];
    expect(nextPendingOp(ops)).toBeNull();
    expect(nextPendingOp([])).toBeNull();
  });
});
