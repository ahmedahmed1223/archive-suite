import { describe, expect, it } from "vitest";
import { buildOperationalSafety } from "./operational-safety";

describe("operational safety", () => {
  it("labels a dry run as a preview that makes no changes", () => {
    const safety = buildOperationalSafety({ action: "تشغيل التحويل", dryRun: true });

    expect(safety.modeLabel).toBe("معاينة جافة");
    expect(safety.summary).toContain("لن تُنفذ أي تغييرات");
  });

  it("requires an explicit confirmation for high-impact actions", () => {
    const safety = buildOperationalSafety({ action: "نشر المادة", impact: "high" });

    expect(safety.requiresConfirmation).toBe(true);
    expect(safety.confirmationLabel).toContain("تأكيد");
  });

  it("blocks actions when rights do not permit the next step", () => {
    const safety = buildOperationalSafety({ action: "مشاركة المراجعة", rights: "blocked" });

    expect(safety.isBlocked).toBe(true);
    expect(safety.blockedLabel).toContain("الحقوق");
    expect(safety.nextStep).toContain("الحقوق");
  });

  it("discloses confidence without presenting it as a guarantee", () => {
    const safety = buildOperationalSafety({ action: "اقتراح الوسوم", confidence: 72 });

    expect(safety.confidenceLabel).toContain("72%");
    expect(safety.confidenceLabel).toContain("تقدير");
  });

  it("provides an audit link for the operation trail", () => {
    const safety = buildOperationalSafety({ action: "حفظ المسودة", auditHref: "/activity?resource=media-123" });

    expect(safety.auditHref).toBe("/activity?resource=media-123");
    expect(safety.auditLabel).toContain("سجل");
  });

  it("describes a synthetic-only simulation without an audit or execution follow-up", () => {
    const safety = buildOperationalSafety({ action: "تشغيل محاكاة", dryRun: true, simulationOnly: true });

    expect(safety.modeLabel).toBe("محاكاة اصطناعية");
    expect(safety.showAuditLink).toBe(false);
    expect(safety.nextStep).not.toContain("نفّذ");
    expect(safety.summary).toContain("اصطناعية");
  });

  it("keeps unverified rights as a server-enforced review state", () => {
    const safety = buildOperationalSafety({ action: "إرسال طلب إلى المساعد", rights: "review" });

    expect(safety.isBlocked).toBe(false);
    expect(safety.rightsReviewLabel).toContain("غير متحققة");
    expect(safety.nextStep).toContain("الخادم");
  });
});
