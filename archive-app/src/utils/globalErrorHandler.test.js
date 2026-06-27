import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  __handleUnhandledRejection,
  __handleWindowError,
  __isGlobalErrorHandlerInstalled,
  __resetGlobalErrorHandlerForTests
} from "./globalErrorHandler.js";
import { __resetErrorLogForTests, listErrors } from "../features/errors/errorLogStore.js";

/**
 * Tests for the global error handler's core logic.
 *
 * The actual window.addEventListener wiring is tested implicitly by the "is a
 * no-op in non-window environments" case. The handler functions are exported
 * as __handleWindowError / __handleUnhandledRejection so we can verify the
 * recordError integration without requiring jsdom.
 */

beforeEach(() => {
  __resetGlobalErrorHandlerForTests();
  __resetErrorLogForTests();
});

describe("globalErrorHandler core logic", () => {
  test("window.onerror records into the error log as critical", () => {
    __handleWindowError({ message: "uncaught boom", error: new Error("uncaught boom") });
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("uncaught boom");
    expect(errors[0].operation).toBe("window.error");
    expect(errors[0].severity).toBe("critical");
  });

  test("window.onerror without Error object still records", () => {
    __handleWindowError({ message: "script error" });
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("script error");
  });

  test("unhandledrejection records into the error log as error", () => {
    __handleUnhandledRejection({ reason: new Error("async fail") });
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("async fail");
    expect(errors[0].operation).toBe("promise.unhandled");
    expect(errors[0].severity).toBe("error");
  });

  test("non-Error rejection reasons are stringified", () => {
    __handleUnhandledRejection({ reason: { code: 42 } });
    expect(listErrors()).toHaveLength(1);
    expect(listErrors()[0].message).toContain("Unhandled rejection");
  });

  test("string rejection reasons are preserved", () => {
    __handleUnhandledRejection({ reason: "something broke" });
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("something broke");
  });

  test("null rejection reasons produce a fallback message", () => {
    __handleUnhandledRejection({ reason: null });
    const errors = listErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Unhandled rejection");
  });
});

describe("globalErrorHandler install state", () => {
  test("starts uninstalled", () => {
    expect(__isGlobalErrorHandlerInstalled()).toBe(false);
  });
});
