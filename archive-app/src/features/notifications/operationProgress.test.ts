// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { startOperation } from "./operationProgress.js";

function makeStore() {
  return {
    showNotification: vi.fn(() => "notif-id"),
    updateNotificationProgress: vi.fn(),
    finalizeNotification: vi.fn(),
  };
}

const noBrowser = { pushDeps: { scope: {} } };

describe("startOperation", () => {
  it("opens a persistent in-progress notification at 0%", () => {
    const store = makeStore();
    const op = startOperation(store, { title: "تصدير", message: "جارٍ…", category: "export", ...noBrowser });
    expect(store.showNotification).toHaveBeenCalledOnce();
    const [message, options] = store.showNotification.mock.calls[0];
    expect(message).toBe("جارٍ…");
    expect(options.progress).toBe(0);
    expect(options.persistent).toBe(true);
    expect(options.category).toBe("export");
    expect(options.id).toBe(op.id);
  });

  it("forwards progress updates to the store", () => {
    const store = makeStore();
    const op = startOperation(store, noBrowser);
    op.setProgress(42);
    expect(store.updateNotificationProgress).toHaveBeenCalledWith(op.id, 42);
  });

  it("finalizes as success with progress 100", () => {
    const store = makeStore();
    const op = startOperation(store, { title: "تصدير", ...noBrowser });
    op.succeed({ message: "تم" });
    expect(store.finalizeNotification).toHaveBeenCalledWith(op.id, {
      type: "success",
      title: "تصدير",
      message: "تم",
      progress: 100,
    });
    expect(op.isDone()).toBe(true);
  });

  it("finalizes as error", () => {
    const store = makeStore();
    const op = startOperation(store, { title: "تصدير", ...noBrowser });
    op.fail({ message: "فشل" });
    expect(store.finalizeNotification).toHaveBeenCalledWith(op.id, {
      type: "error",
      title: "تصدير",
      message: "فشل",
    });
  });

  it("is idempotent - a second terminal call is a no-op", () => {
    const store = makeStore();
    const op = startOperation(store, noBrowser);
    op.succeed({ message: "تم" });
    op.fail({ message: "فشل" });
    op.setProgress(99);
    expect(store.finalizeNotification).toHaveBeenCalledOnce();
    expect(store.updateNotificationProgress).not.toHaveBeenCalled();
  });
});
