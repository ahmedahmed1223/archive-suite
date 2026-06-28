const MESSAGES = {
  unknownError:         { ar: "حدث خطأ غير معروف",           en: "An unknown error occurred" },
  operationFailed:      { ar: "تعذّر تنفيذ العملية",          en: "Operation failed" },
  networkError:         { ar: "خطأ في الشبكة، تحقق من الاتصال", en: "Network error, check your connection" },
  unauthorized:         { ar: "غير مصرح بهذه العملية",         en: "You are not authorized to perform this action" },
  notFound:             { ar: "العنصر المطلوب غير موجود",        en: "The requested item was not found" },
  validationFailed:     { ar: "البيانات المدخلة غير صالحة",     en: "The submitted data is invalid" },
  saveFailed:           { ar: "تعذّر حفظ البيانات",             en: "Failed to save data" },
  loadFailed:           { ar: "تعذّر تحميل البيانات",           en: "Failed to load data" },
  deleteFailed:         { ar: "تعذّر حذف العنصر",               en: "Failed to delete item" },
  uploadFailed:         { ar: "تعذّر رفع الملف",                en: "File upload failed" },
  exportFailed:         { ar: "تعذّر تصدير البيانات",           en: "Data export failed" },
  importFailed:         { ar: "تعذّر استيراد البيانات",          en: "Data import failed" },
  sessionExpired:       { ar: "انتهت الجلسة، يرجى تسجيل الدخول مجدداً", en: "Session expired, please log in again" },
  permissionDenied:     { ar: "ليس لديك صلاحية للوصول",         en: "You do not have permission to access this" },
  serverError:          { ar: "خطأ في الخادم، حاول مرة أخرى",   en: "Server error, please try again" },
  timeout:              { ar: "انتهت مهلة الطلب",               en: "Request timed out" },
  conflictError:        { ar: "تعارض في البيانات، يرجى التحديث", en: "Data conflict, please refresh" },
  quotaExceeded:        { ar: "تجاوزت الحصة المسموح بها",        en: "Storage quota exceeded" },
  fileTooBig:           { ar: "حجم الملف أكبر من المسموح",       en: "File size exceeds the allowed limit" },
  unsupportedFormat:    { ar: "تنسيق الملف غير مدعوم",           en: "File format is not supported" },
  backupFailed:         { ar: "تعذّر إنشاء النسخة الاحتياطية",   en: "Backup creation failed" },
  restoreFailed:        { ar: "تعذّر استعادة النسخة الاحتياطية", en: "Backup restore failed" },
  aiError:              { ar: "تعذّر تنفيذ عملية الذكاء الاصطناعي", en: "AI operation failed" },
  syncFailed:           { ar: "تعذّر مزامنة البيانات",            en: "Data sync failed" },
  connectionLost:       { ar: "انقطع الاتصال بالخادم",            en: "Connection to server lost" },
};

function isArabicLocale() {
  try {
    const lang = (typeof navigator !== "undefined" && navigator.language) || "ar";
    return lang.startsWith("ar");
  } catch {
    return true;
  }
}

/**
 * Returns the localized message string for a known error key.
 * Falls back to Arabic when the key is unknown.
 */
export function getErrorMessage(key: keyof typeof MESSAGES) {
  const entry = MESSAGES[key];
  if (!entry) return isArabicLocale() ? MESSAGES.unknownError.ar : MESSAGES.unknownError.en;
  return isArabicLocale() ? entry.ar : entry.en;
}

export const ERROR_MESSAGES = MESSAGES;
