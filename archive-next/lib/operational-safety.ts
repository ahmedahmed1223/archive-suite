export type OperationalImpact = "low" | "high";
export type OperationalRights = "allowed" | "blocked" | "review";

export type OperationalSafetyInput = {
  action: string;
  auditHref?: string;
  confidence?: number;
  dryRun?: boolean;
  impact?: OperationalImpact;
  rights?: OperationalRights;
  simulationOnly?: boolean;
};

export type OperationalSafety = {
  auditHref: string;
  auditLabel: string;
  blockedLabel?: string;
  confidenceLabel?: string;
  confirmationLabel?: string;
  rightsReviewLabel?: string;
  isBlocked: boolean;
  modeLabel: string;
  nextStep: string;
  requiresConfirmation: boolean;
  showAuditLink: boolean;
  summary: string;
};

export function buildOperationalSafety({
  action,
  auditHref = "/activity",
  confidence,
  dryRun = false,
  impact = "low",
  rights = "allowed",
  simulationOnly = false
}: OperationalSafetyInput): OperationalSafety {
  const isBlocked = rights === "blocked";
  const requiresRightsReview = rights === "review";
  const requiresConfirmation = impact === "high" && !dryRun && !isBlocked;
  const modeLabel = simulationOnly ? "محاكاة اصطناعية" : dryRun ? "معاينة جافة" : "تنفيذ تشغيلي";

  return {
    auditHref,
    auditLabel: "عرض سجل التدقيق",
    blockedLabel: isBlocked ? "محظور بالحقوق الحالية" : undefined,
    confidenceLabel: typeof confidence === "number" ? `الثقة: ${Math.max(0, Math.min(100, Math.round(confidence)))}% (تقدير قابل للمراجعة)` : undefined,
    confirmationLabel: requiresConfirmation ? `تأكيد ${action}` : undefined,
    isBlocked,
    modeLabel,
    requiresConfirmation,
    rightsReviewLabel: requiresRightsReview ? "الحقوق غير متحققة محلياً؛ القرار النهائي للخادم." : undefined,
    showAuditLink: !simulationOnly,
    nextStep: simulationOnly
      ? "الخطوة التالية: غيّر المعرفات أو السيناريو ثم شغّل محاكاة اصطناعية مستقلة."
      : isBlocked
        ? "الخطوة التالية: راجع الحقوق أو اطلب تفويضاً مناسباً."
        : requiresRightsReview
          ? "الخطوة التالية: يطبق الخادم سياسات الحقوق والصلاحيات عند تنفيذ الطلب."
          : dryRun
            ? "الخطوة التالية: راجع النتائج ثم نفّذ الإجراء عند الجاهزية."
            : requiresConfirmation
              ? "الخطوة التالية: أكّد الإجراء عالي التأثير قبل المتابعة."
              : "الخطوة التالية: راجع السجل بعد اكتمال الإجراء.",
    summary: simulationOnly
      ? `${action}: محاكاة اصطناعية فقط ولا ينتج عنها أي تغيير أو تنفيذ.`
      : dryRun
      ? `معاينة ${action}: لن تُنفذ أي تغييرات.`
      : isBlocked
        ? `${action} متوقف: لا تسمح الحقوق الحالية بهذا الإجراء.`
        : requiresConfirmation
          ? `${action} عالي التأثير ويتطلب تأكيداً صريحاً.`
          : `${action} ضمن النطاق التشغيلي الحالي.`
  };
}
