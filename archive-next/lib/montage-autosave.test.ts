import { describe, expect, it, vi } from "vitest";
import { createAutosaveCoordinator, type ApiClient } from "./montage-autosave";

const payload = { expectedRevision: 3, tracks: [], clips: [] };

function makeApi(over: Partial<Record<keyof ApiClient, unknown>> = {}): ApiClient {
  return {
    saveRevision: vi.fn(async () => ({ ok: true, revisionNumber: 4 })),
    ...over,
  } as unknown as ApiClient;
}

describe("autosave coordinator (Task 4)", () => {
  it("reports an explicit conflict on 409 without discarding edits", async () => {
    const api = makeApi({
      saveRevision: vi.fn(async () => ({ ok: false, status: 409, currentRevision: 7 })),
    });
    const coordinator = createAutosaveCoordinator(api, "p1");
    coordinator.schedule(payload, 0);

    const result = await new Promise((resolve) => {
      setTimeout(() => resolve(coordinator.flush()), 5);
    }) as Awaited<ReturnType<typeof coordinator.flush>>;

    // The payload is still in the coordinator; conflict is a decision, not data loss.
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") expect(result.currentRevision).toBe(7);
    coordinator.dispose();
  });

  it("flush returns saved with the new revision number", async () => {
    const api = makeApi();
    const coordinator = createAutosaveCoordinator(api, "p1");
    coordinator.schedule(payload, 0);
    const result = await coordinator.flush();
    expect(result).toEqual({ status: "saved", revisionNumber: 4 });
    coordinator.dispose();
  });

  it("aborts the superseded request when a newer edit arrives", async () => {
    const signals: AbortSignal[] = [];
    const api = makeApi({
      saveRevision: vi.fn(async (_id: string, _p: unknown, signal: AbortSignal) => {
        signals.push(signal);
        return { ok: true, revisionNumber: signals.length + 3 };
      }),
    });
    const coordinator = createAutosaveCoordinator(api, "p1");
    coordinator.schedule({ expectedRevision: 3, tracks: [], clips: [] }, 0);
    const first = coordinator.flush();
    coordinator.schedule({ expectedRevision: 4, tracks: [], clips: [] }, 0);
    await Promise.all([first, coordinator.flush()]);

    expect(signals.length).toBeGreaterThanOrEqual(2);
    expect(signals[0].aborted).toBe(true); // superseded
    coordinator.dispose();
  });

  it("errors cleanly when flushed with nothing to save", async () => {
    const coordinator = createAutosaveCoordinator(makeApi(), "p1");
    const result = await coordinator.flush();
    expect(result.status).toBe("error");
    coordinator.dispose();
  });
});
