/**
 * Transactional multi-step writes (§1281).
 *
 * Wraps a sequence of write steps so that if any step fails, the steps that
 * already succeeded are rolled back in reverse order. This prevents partial
 * compound operations (e.g. "create item + link to collection + index") from
 * leaving the store in an inconsistent state.
 *
 * A step is: { name, apply: async () => result, rollback?: async (result) => void }
 * rollback receives the value that `apply` returned, so it can undo precisely.
 */

/**
 * @returns {Promise<{ ok: boolean, results?: any[], error?: Error, rolledBack?: number, rollbackErrors?: Error[] }>}
 */
export async function runTransactionalWrite(steps = [], options = {}) {
  const list = Array.isArray(steps) ? steps.filter(Boolean) : [];
  const done = [];
  try {
    const results = [];
    for (const step of list) {
      if (typeof step.apply !== "function") {
        throw new Error(`الخطوة "${step.name || "?"}" بلا دالة تنفيذ`);
      }
      const result = await step.apply();
      done.push({ step, result });
      results.push(result);
    }
    return { ok: true, results };
  } catch (error) {
    const rollbackErrors = [];
    for (let index = done.length - 1; index >= 0; index -= 1) {
      const { step, result } = done[index];
      try {
        await step.rollback?.(result);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (typeof options.onRollback === "function") {
      try {
        options.onRollback({ error, rolledBack: done.length, rollbackErrors });
      } catch {
        /* reporting must never throw */
      }
    }
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
      rolledBack: done.length,
      rollbackErrors
    };
  }
}
