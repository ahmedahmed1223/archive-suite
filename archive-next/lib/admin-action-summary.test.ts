import { describe, expect, it } from "vitest";
import {
  buildBackupFreshness,
  buildExportPreview,
  buildShareExpiry,
  groupActionErrors,
  redactAdminSecrets
} from "./admin-action-summary";

describe("admin action summaries", () => {
  it("redacts credential-like values while retaining safe context", () => {
    expect(redactAdminSecrets("Bearer super-secret-token; password=hunter2; host=archive"))
      .toBe("Bearer ••••; password=••••; host=archive");
  });

  it("redacts JSON credentials and Authorization headers", () => {
    const redacted = redactAdminSecrets('{"token":"abc123","apiKey":"key-123","Authorization":"Bearer raw-token"}');
    expect(redacted).toContain('"token":"••••"');
    expect(redacted).toContain('"apiKey":"••••"');
    expect(redacted).toContain('"Authorization":"Bearer ••••"');
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("raw-token");
  });

  it("redacts credentials embedded in an administrative recovery error", () => {
    expect(redactAdminSecrets("Restore failed: Authorization: Bearer restore-token; apiKey=restore-key"))
      .toBe("Restore failed: Authorization: Bearer ••••; apiKey=••••");
  });

  it("derives an explicit expiry state for shares", () => {
    expect(buildShareExpiry("2026-07-10T10:00:00.000Z", new Date("2026-07-11T10:00:00.000Z"))).toMatchObject({
      tone: "danger",
      label: "منتهية"
    });
    expect(buildShareExpiry("2026-07-12T10:00:00.000Z", new Date("2026-07-11T10:00:00.000Z"))).toMatchObject({
      tone: "warning",
      label: "تنتهي قريباً"
    });
  });

  it("describes the actual capped export scope rather than visible rows", () => {
    expect(buildExportPreview({ total: 12000, format: "CSV", limit: 10000 })).toEqual({
      tone: "warning",
      summary: "سيُصدّر أول 10000 من 12000 نتيجة مطابقة",
      detail: "التنسيق: CSV. راجع الفلاتر قبل التصدير."
    });
  });

  it("marks backup freshness from the latest successful backup", () => {
    expect(buildBackupFreshness("2026-07-11T09:30:00.000Z", new Date("2026-07-11T10:00:00.000Z"))).toMatchObject({
      tone: "success",
      label: "حديثة"
    });
    expect(buildBackupFreshness(undefined, new Date("2026-07-11T10:00:00.000Z"))).toMatchObject({
      tone: "danger",
      label: "لا توجد نسخة"
    });
  });

  it("uses the newest backup time even when the source list is unordered", () => {
    expect(buildBackupFreshness(["2026-07-10T09:00:00.000Z", "2026-07-11T09:30:00.000Z"], new Date("2026-07-11T10:00:00.000Z"))).toMatchObject({
      tone: "success",
      label: "حديثة"
    });
  });

  it("groups repeated errors into actionable recovery summaries", () => {
    expect(groupActionErrors([
      { message: "Network request failed", page: "/backup" },
      { message: "Network request failed", page: "/backup" },
      { message: "Forbidden", page: "/plugins" }
    ])).toEqual([
      { key: "network", count: 2, label: "تعذر الاتصال", recovery: "تحقق من الاتصال ثم أعد المحاولة." },
      { key: "access", count: 1, label: "صلاحية غير كافية", recovery: "تحقق من صلاحياتك أو تواصل مع المسؤول." }
    ]);
  });
});
