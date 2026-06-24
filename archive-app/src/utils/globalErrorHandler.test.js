import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  __resetGlobalErrorHandlerForTests,
  installGlobalErrorHandler
} from "./globalErrorHandler.js";
import { __resetErrorLogForTests, listErrors } from "../features/errors/errorLogStore.js";

/**
 * The global handler registers real window.addEventListener listeners. In the
 * default Vitest environment (node) `ErrorEvent` and `PromiseRejectionEvent` are
 * not defined, so we inject them before the tests and call the handlers
 * directly via the captured listener references instead of dispatchEvent.
 */

// Minimal shims so window.<event> constructors don't throw
function installEventShims() {
  if (typeof ErrorEvent === "undefined") {
    // @ts-expect-error -- shim for test env only
    globalThis.ErrorEvent = class ErrorEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.message = init.message || "";
        this.filename = init.filename || "";
        this.lineno = init.lineno || 0;
        this.error = init.error || null;
      }
    };
  }
  if (typeof PromiseRejectionEvent === "undefined") {
    // @ts-expect-error -- shim for test env only
    globalThis.PromiseRejectionEvent = class PromiseRejectionEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.promise = init.promise || Promise.reject();
        this.reason = init.reason;
        this.cancelable = init.cancelable ?? true;
      }
    };
  }
}

beforeEach(() => {
  __resetGlobalErrorHandlerForTests();
  __resetErrorLogForTests();
  installEventShims();
});

describe("globalErrorHandler", () => {
  test("window.onerror records into the error log", () => {
    installGlobalErrorHandler();
    // Call the handler directly (simulates what window does)
    window.dispatchEvent(new ErrorEvent("error", {
      message: "uncaught boom",
      filename: "app.js",
      lineno: 42,
      error: new Error("uncaught boom")
    }));
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("uncaught boom");
    expect(errors[0].operation).toBe("window.error");
    expect(errors[0].severity).toBe("critical");
  });

  test("window.onerror without Error object still records", () => {
    installGlobalErrorHandler();
    window.dispatchEvent(new ErrorEvent("error", {
      message: "script error",
      filename: "external.js",
      lineno: 1
    }));
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("script error");
  });

  test("unhandledrejection records into the error log", () => {
    installGlobalErrorHandler();
    const reason = new Error("async fail");
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.reject(reason),
      reason,
      cancelable: true
    }));
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("async fail");
    expect(errors[0].operation).toBe("promise.unhandled");
    expect(errors[0].severity).toBe("error");
  });

  test("non-Error rejection reasons are stringified", () => {
    installGlobalErrorHandler();
    window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.reject({ code: 42 }),
      reason: { code: 42 },
      cancelable: true
    }));
    expect(listErrors()).toHaveLength(1);
    expect(listErrors()[0].message).toContain("Unhandled rejection");
  });

  test("install is idempotent — no duplicate handlers", () => {
    const uninstall = installGlobalErrorHandler();
    installGlobalErrorHandler();
    window.dispatchEvent(new ErrorEvent("error", { message: "once", error: new Error("once") }));
    // If handlers doubled, we'd get 2 entries.
    expect(listErrors()).toHaveLength(1);
    uninstall();
  });

  test("uninstall removes handlers — no more recording", () => {
    const uninstall = installGlobalErrorHandler();
    uninstall();
    window.dispatchEvent(new ErrorEvent("error", { message: "after", error: new Error("after") }));
    expect(listErrors()).toHaveLength(0);
  });

  test("is a no-op in non-window environments", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error -- temporarily remove window
    delete globalThis.window;
    const result = installGlobalErrorHandler();
    expect(result).toEqual(expect.any(Function));
    // Cleanup
    globalThis.window = origWindow;
  });
});
