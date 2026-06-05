const KNOWN_ERROR_PATTERNS = [
  {
    test: (message) => /quota|storage|disk full|insufficient/i.test(message),
    reason: "مساحة التخزين غير كافية",
    hint: "المساحة المتاحة لا تكفي. جرّب تصدير نسخة احتياطية ثم تفريغ بيانات قديمة."
  },
  {
    test: (message) => /unique|duplicate|already exists|موجود/i.test(message),
    reason: "قيمة مكررة",
    hint: "هذا العنصر موجود بالفعل. غيّر الاسم أو المعرّف ثم أعد المحاولة."
  },
  {
    test: (message) => /required|missing|empty|فارغ|مطلوب/i.test(message),
    reason: "بيانات ناقصة",
    hint: "أحد الحقول المطلوبة فارغ. راجع النموذج وأكمل البيانات الناقصة."
  },
  {
    test: (message) => /network|fetch|timeout|connection/i.test(message),
    reason: "اتصال غير مستقر",
    hint: "يبدو أن الاتصال انقطع. تأكد من الشبكة ثم أعد المحاولة."
  },
  {
    test: (message) => /permission|denied|forbidden|unauthorized|صلاحية|مرفوض/i.test(message),
    reason: "صلاحية غير كافية",
    hint: "لا تملك صلاحية لهذا الإجراء. تواصل مع المدير لرفع الصلاحيات."
  }
];

function extractErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.message) return String(error.message);
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function buildHint(message) {
  for (const entry of KNOWN_ERROR_PATTERNS) {
    if (entry.test(message)) return entry.hint;
  }
  return null;
}

function classifyError(message) {
  for (const entry of KNOWN_ERROR_PATTERNS) {
    if (entry.test(message)) return { reason: entry.reason, hint: entry.hint };
  }
  return {
    reason: "خطأ غير متوقع",
    hint: "أعد المحاولة. إذا تكرر الخطأ، انسخ التفاصيل التقنية وراجع سجل النظام."
  };
}

export function createRecoveryNotice(error, options = {}) {
  const rawMessage = extractErrorMessage(error);
  const context = options.context || "العملية الأخيرة";
  const classification = classifyError(rawMessage);
  const reason = options.reason || classification.reason;
  const hint = options.hint || buildHint(rawMessage) || classification.hint;
  const title = options.title || `فشل ${context}`;
  const technicalDetails = [
    `context: ${context}`,
    `reason: ${reason}`,
    rawMessage && `message: ${rawMessage}`,
    error?.stack && `stack: ${error.stack}`
  ].filter(Boolean).join("\n");
  const message = [
    reason && `السبب: ${reason}`,
    rawMessage && `التفاصيل: ${rawMessage}`,
    hint && `التعافي: ${hint}`
  ].filter(Boolean).join("\n");
  return {
    title,
    message: message || "حدث خطأ غير متوقع.\nالتعافي: أعد المحاولة أو راجع السجل.",
    reason,
    hint,
    technicalDetails
  };
}

/**
 * Report an error through the shared notification system with optional recovery action.
 *
 * Usage:
 *   reportError(showNotification, err, {
 *     context: "حفظ المستخدم",
 *     recovery: { label: "إعادة المحاولة", run: () => save(draft) }
 *   })
 *
 * Returns the notification id (string) so the caller can dismiss it later.
 */
export function reportError(showNotification, error, options = {}) {
  if (typeof showNotification !== "function") return null;
  const notice = createRecoveryNotice(error, options);
  const payload = {
    type: "error",
    title: notice.title,
    persistent: options.persistent !== false,
    reason: notice.reason,
    technicalDetails: notice.technicalDetails
  };
  if (options.recovery && typeof options.recovery.run === "function") {
    payload.action = {
      label: options.recovery.label || "إعادة المحاولة",
      run: options.recovery.run,
      dismissOnRun: options.recovery.dismissOnRun !== false
    };
  }
  return showNotification(notice.message, payload);
}

/**
 * Convenience wrapper that resolves the showNotification action from a store getter
 * and forwards to reportError. Useful from non-React code paths.
 */
export function createErrorReporter(getStore) {
  return function (error, options = {}) {
    const state = typeof getStore === "function" ? getStore() : getStore;
    const showNotification = state?.showNotification;
    return reportError(showNotification, error, options);
  };
}
