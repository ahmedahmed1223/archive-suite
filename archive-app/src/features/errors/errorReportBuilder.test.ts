import { describe, expect, test } from "vitest";
import { ERROR_SEVERITY, buildErrorReport, formatErrorReport } from "./errorReportBuilder.js";

describe("buildErrorReport", () => {
  test("normalizes an Error with context", () => {
    const report = buildErrorReport(new Error("disk full"), {
      page: "archive",
      operation: "item.write",
      severity: ERROR_SEVERITY.CRITICAL,
      suggestion: "حرّر مساحة"
    });
    expect(report.message).toBe("disk full");
    expect(report.name).toBe("Error");
    expect(report.page).toBe("archive");
    expect(report.severity).toBe("critical");
    expect(report.suggestion).toBe("حرّر مساحة");
    expect(report.id).toMatch(/^err_/);
    expect(report.device).toBeTruthy();
  });

  test("handles string errors and unknown severity", () => {
    const report = buildErrorReport("plain failure", { severity: "nonsense" });
    expect(report.message).toBe("plain failure");
    expect(report.severity).toBe("error");
  });

  test("falls back gracefully on null error", () => {
    const report = buildErrorReport(null);
    expect(report.message).toBe("خطأ غير معروف");
  });
});

describe("formatErrorReport", () => {
  test("renders a readable multi-line report", () => {
    const report = buildErrorReport(new Error("boom"), { page: "detail", operation: "save" });
    const text = formatErrorReport(report);
    expect(text).toContain("تقرير خطأ");
    expect(text).toContain("الصفحة: detail");
    expect(text).toContain("boom");
  });

  test("returns empty string for missing report", () => {
    expect(formatErrorReport(null)).toBe("");
  });
});
