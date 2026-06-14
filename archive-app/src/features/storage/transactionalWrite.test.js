import { describe, expect, test, vi } from "vitest";
import { runTransactionalWrite } from "./transactionalWrite.js";

describe("runTransactionalWrite", () => {
  test("runs all steps and returns results in order", async () => {
    const result = await runTransactionalWrite([
      { name: "a", apply: async () => 1 },
      { name: "b", apply: async () => 2 }
    ]);
    expect(result.ok).toBe(true);
    expect(result.results).toEqual([1, 2]);
  });

  test("rolls back completed steps in reverse on failure", async () => {
    const order = [];
    const result = await runTransactionalWrite([
      { name: "a", apply: async () => "ra", rollback: async (r) => order.push(`undo-a:${r}`) },
      { name: "b", apply: async () => "rb", rollback: async (r) => order.push(`undo-b:${r}`) },
      { name: "c", apply: async () => { throw new Error("fail at c"); } }
    ]);
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("fail at c");
    expect(result.rolledBack).toBe(2);
    // b rolled back before a (reverse order)
    expect(order).toEqual(["undo-b:rb", "undo-a:ra"]);
  });

  test("collects rollback errors without throwing", async () => {
    const result = await runTransactionalWrite([
      { name: "a", apply: async () => "ra", rollback: async () => { throw new Error("rollback boom"); } },
      { name: "b", apply: async () => { throw new Error("step boom"); } }
    ]);
    expect(result.ok).toBe(false);
    expect(result.rollbackErrors).toHaveLength(1);
    expect(result.rollbackErrors[0].message).toBe("rollback boom");
  });

  test("invokes onRollback callback with summary", async () => {
    const onRollback = vi.fn();
    await runTransactionalWrite(
      [{ name: "a", apply: async () => 1, rollback: async () => {} }, { name: "b", apply: async () => { throw new Error("x"); } }],
      { onRollback }
    );
    expect(onRollback).toHaveBeenCalledWith(expect.objectContaining({ rolledBack: 1 }));
  });

  test("throws-free on a step missing apply", async () => {
    const result = await runTransactionalWrite([{ name: "bad" }]);
    expect(result.ok).toBe(false);
    expect(result.error.message).toContain("bad");
  });
});
