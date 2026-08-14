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
  locale?: "ar" | "en";
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
  simulationOnly = false,
  locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar"
}: OperationalSafetyInput): OperationalSafety {
  const isBlocked = rights === "blocked";
  const requiresRightsReview = rights === "review";
  const requiresConfirmation = impact === "high" && !dryRun && !isBlocked;
  const modeLabel = locale === "ar"
    ? simulationOnly ? "محاكاة اصطناعية" : dryRun ? "معاينة جافة" : "تنفيذ تشغيلي"
    : simulationOnly ? "Synthetic simulation" : dryRun ? "Dry-run preview" : "Operational execution";

  return {
    auditHref,
    auditLabel: locale === "ar" ? "عرض سجل التدقيق" : "View audit log",
    blockedLabel: isBlocked ? locale === "ar" ? "محظور بالحقوق الحالية" : "Blocked by current permissions" : undefined,
    confidenceLabel: typeof confidence === "number" ? locale === "ar" ? `الثقة: ${Math.max(0, Math.min(100, Math.round(confidence)))}% (تقدير قابل للمراجعة)` : `Confidence: ${Math.max(0, Math.min(100, Math.round(confidence)))}% (reviewable estimate)` : undefined,
    confirmationLabel: requiresConfirmation ? locale === "ar" ? `تأكيد ${action}` : `Confirm ${action}` : undefined,
    isBlocked,
    modeLabel,
    requiresConfirmation,
    rightsReviewLabel: requiresRightsReview ? locale === "ar" ? "الحقوق غير متحققة محلياً؛ القرار النهائي للخادم." : "Rights are not verified locally; the server makes the final decision." : undefined,
    showAuditLink: !simulationOnly,
    nextStep: locale === "ar" ? simulationOnly ? "الخطوة التالية: غيّر المعرفات أو السيناريو ثم شغّل محاكاة اصطناعية مستقلة." : isBlocked ? "الخطوة التالية: راجع الحقوق أو اطلب تفويضاً مناسباً." : requiresRightsReview ? "الخطوة التالية: يطبق الخادم سياسات الحقوق والصلاحيات عند تنفيذ الطلب." : dryRun ? "الخطوة التالية: راجع النتائج ثم نفّذ الإجراء عند الجاهزية." : requiresConfirmation ? "الخطوة التالية: أكّد الإجراء عالي التأثير قبل المتابعة." : "الخطوة التالية: راجع السجل بعد اكتمال الإجراء."
      : simulationOnly ? "Next: change the identifiers or scenario, then run an independent synthetic simulation." : isBlocked ? "Next: review the rights or request appropriate authorization." : requiresRightsReview ? "Next: the server applies rights and permission policies when it processes the request." : dryRun ? "Next: review the results, then run the action when ready." : requiresConfirmation ? "Next: confirm the high-impact action before continuing." : "Next: review the audit log after the action completes.",
    summary: locale === "ar" ? simulationOnly ? `${action}: محاكاة اصطناعية فقط ولا ينتج عنها أي تغيير أو تنفيذ.` : dryRun ? `معاينة ${action}: لن تُنفذ أي تغييرات.` : isBlocked ? `${action} متوقف: لا تسمح الحقوق الحالية بهذا الإجراء.` : requiresConfirmation ? `${action} عالي التأثير ويتطلب تأكيداً صريحاً.` : `${action} ضمن النطاق التشغيلي الحالي.`
      : simulationOnly ? `${action}: synthetic simulation only; no change or execution will occur.` : dryRun ? `Preview ${action}: no changes will be executed.` : isBlocked ? `${action} is blocked: current permissions do not allow this action.` : requiresConfirmation ? `${action} is high impact and requires explicit confirmation.` : `${action} is within the current operational scope.`
  };
}
